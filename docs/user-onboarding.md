# 1. User Onboarding

**What it is.** Login and sign-up: mobile number → mobile OTP → (new users)
name + email → email OTP → dashboard. Being invited to someone else's lock is a
separate flow — see [Lock Share Invites](lock-share-invites.md).

!!! warning "Key point"

    Login makes **no Spintly SDK calls** and **never reaches Spintly's
    backend**. It runs on Keycloak over plain HTTP (OAuth 2.0 + PKCE). The SDKs
    are touched only at app launch and after login, to trade the Keycloak token
    for a Spintly session.

**Covers three cases**, all on the same code path — the SDK work keys off having
a valid Keycloak token, not off how the user got one:

| Case | Screens | SDK behaviour |
|---|---|---|
| New user | number → mobile OTP → name + email → email OTP | Full sequence below |
| Existing user | number → mobile OTP, then straight in | Same. Keycloak returns the auth code right after the mobile OTP, so the email screens are skipped |
| Returning user (saved session still valid) | none — splash goes straight to Home | Skips the login-start logout and the entire OAuth exchange. Both platforms check `isLoggedIn` first and go straight to `pollData` |

## SDK members used

The SDK work splits into six moments in the app's life. Each diagram below reads
top to bottom, one moment at a time, and a box's outline colour says which of the
three SDKs the member belongs to.

<p class="sdk-key">
  <span class="k-oauth">OAuth SDK</span>
  <span class="k-access">Access SDK</span>
  <span class="k-config">Config SDK</span>
  <span class="k-flow">app / platform step</span>
  <span class="k-fail">failure path</span>
</p>

!!! tip "Tabs are linked"

    Pick **iOS** or **Android** in any tab below and every other diagram on this
    page switches with it.

### 1. App launch

Create the three SDKs, then point each one at an environment. All of it runs
before the user sees a login screen. Numbers read create-first, configure-second.

=== "iOS"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":540,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["App starts"]) --> N1
        N1["<b>1 · SpintlyOauthManager(clientId:provider:environment:)</b><br/>Create the OAuth manager"]
        N1 --> N2["<b>2 · SpintlyACServiceProvider.defaultInstance</b><br/>Get the Access SDK instance"]
        N2 --> N3["<b>3 · SpintlyConfigurationProvider.defaultInstance</b><br/>Get the Config SDK instance"]
        N3 --> M(["All three SDKs now exist — configure them"])
        M --> N4["<b>4 · environmentManager.setEnvironment(_:)</b><br/>Point the Access SDK at the environment"]
        N4 --> N5["<b>5 · credentialManager.setRefreshTokenDelegate(_:)</b><br/>Register our token-refresh handler"]
        N5 --> N6["<b>6 · credentialManager.setLoginStatusDelegate(delegate:)</b><br/>Register our login-status handler"]
        N6 --> N7["<b>7 · configurationProvider.getVersion()</b><br/>Read the SDK version for logs"]
        N7 --> N8["<b>8 · configurationProvider.setDebugLogging(enabled:)</b><br/>Turn on SDK logging — debug builds only"]
        N8 --> N9["<b>9 · configurationProvider.setEnvironment(environment:region:)</b><br/>Point the Config SDK at the environment"]
        N9 --> E(["Ready — waiting for a Keycloak token"])

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef sdkAccess stroke:#3b82f6,stroke-width:2px
        classDef sdkConfig stroke:#f59e0b,stroke-width:2px
        class N1 sdkOauth
        class N2,N4,N5,N6 sdkAccess
        class N3,N7,N8,N9 sdkConfig
    ```

=== "Android"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":540,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["App starts"]) --> N1
        N1["<b>1 · SpintlyOauthManager(context, clientId, providerId, environment)</b><br/>Create the OAuth manager"]
        N1 --> N2["<b>2 · SpintlyACServiceProvider.getDefaultInstance(context)</b><br/>Get the Access SDK instance"]
        N2 --> N3["<b>3 · SpintlyConfigurationProvider.getDefaultInstance(context)</b><br/>Get the Config SDK instance"]
        N3 --> M(["All three SDKs now exist — configure them"])
        M --> N4["<b>4 · environmentManager.environment = …</b><br/>Point the Access SDK at the environment"]
        N4 --> N5["<b>5 · credentialManager.setTokenRefreshHandler { }</b><br/>Register our token-refresh handler, in the init block"]
        N5 --> N6["<b>6 · configurationProvider.setEnvironment(environment, region)</b><br/>Point the Config SDK at the environment"]
        N6 --> E(["Ready — waiting for a Keycloak token"])
        N6 -.->|"and again, every time"| R["<b>configurationProvider.setEnvironment(environment, region)</b><br/>Re-applied before every Config SDK call — no iOS equivalent"]

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef sdkAccess stroke:#3b82f6,stroke-width:2px
        classDef sdkConfig stroke:#f59e0b,stroke-width:2px
        class N1 sdkOauth
        class N2,N4,N5 sdkAccess
        class N3,N6,R sdkConfig
    ```

### 2. Login starts

The one moment where the platforms disagree outright: Android wipes any previous
user's SDK state before a new login begins, iOS does not.

=== "iOS"

    Nothing. iOS makes **no SDK calls** when a login starts — no `logOut()`, no
    `clearSession()`. Whatever the previous user left in the Access and OAuth
    SDKs is still there when the next login runs.

=== "Android"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":540,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["User begins a login"]) --> N1
        N1["<b>1 · credentialManager.logOut()</b><br/>Clear any previous user's session"]
        N1 --> N2["<b>2 · oauthManager.clearSession()</b><br/>Clear the OAuth session"]
        N2 --> E(["Clean slate — hand off to Keycloak"])

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef sdkAccess stroke:#3b82f6,stroke-width:2px
        class N2 sdkOauth
        class N1 sdkAccess
    ```

### 3. After login — trading the Keycloak token

Keycloak has returned an auth code and the app holds a Keycloak token. This is
the OAuth SDK exchange, and it is a **conversation**: the app asks for a session,
the SDK asks the app how to authenticate, the app hands back a token-exchange
request, and the SDK returns the session.

=== "iOS"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":570,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["Keycloak token in hand"]) --> N1
        N1["<b>1 · oauthManager.getOrCreateSession(delegate:)</b><br/>Ask the OAuth SDK for a Spintly session"]
        N1 --> N2["<b>2 · AuthorizationDelegate → getAuthenticationDetails</b><br/>The SDK calls back, asking us how to authenticate"]
        N2 --> N3["<b>3 · AuthenticationDetails.createWithTokenExchangeGrantType(clientToken:)</b><br/>Build the token-exchange request from the Keycloak token"]
        N3 --> N4["<b>4 · AuthenticationContinuation.setAuthenticationDetails(authenticationDetails:)</b><br/>Hand the request back to the SDK"]
        N4 --> N5["<b>5 · AuthenticationContinuation.continueTask()</b><br/>Let the SDK carry on"]
        N5 --> D{"Exchange<br/>succeeded?"}
        D -->|yes| N6["<b>6 · AuthorizationDelegate → didGetSession</b><br/>The SDK hands the session back"]
        D -->|no| F["<b>AuthorizationDelegate → didFailWithError</b><br/>Exchange failed, no Spintly session"]
        N6 --> N7["<b>7 · SpintlyOauthSession.accessToken.jwtToken</b><br/>Read the Spintly token out of the session"]
        N7 --> E(["Spintly token in hand — go to step 4"])

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef fail stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 3
        class N1,N2,N3,N4,N5,N6,N7 sdkOauth
        class F fail
    ```

=== "Android"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":570,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["Keycloak token in hand"]) --> N1
        N1["<b>1 · oauthManager.getOrCreateSession(AuthorizationCallback)</b><br/>Ask the OAuth SDK for a Spintly session"]
        N1 --> N2["<b>2 · AuthorizationCallback → getAuthenticationDetails</b><br/>The SDK calls back, asking us how to authenticate"]
        N2 --> N3["<b>3 · AuthenticationDetails.createWithTokenExchangeGrantType(jwtToken)</b><br/>Build the token-exchange request from the Keycloak token"]
        N3 --> N4["<b>4 · AuthenticationContinuation.setAuthenticationDetails(details)</b><br/>Hand the request back to the SDK"]
        N4 --> N5["<b>5 · AuthenticationContinuation.continueTask()</b><br/>Let the SDK carry on"]
        N5 --> D{"Exchange<br/>succeeded?"}
        D -->|yes| N6["<b>6 · AuthorizationCallback → onSuccess</b><br/>The SDK hands the session back"]
        D -->|no| F["<b>AuthorizationCallback → onFailure</b><br/>Reported as SpintlyOauthNotAuthorizedException"]
        N6 --> N7["<b>7 · SpintlyOauthSession.isValidForThreshold</b><br/>Check the session isn't about to expire — iOS decodes the JWT's exp instead"]
        N7 --> D2{"Still<br/>fresh?"}
        D2 -->|no| N8["<b>8 · oauthManager.clearSession()</b><br/>Throw the stale session away"]
        D2 -->|yes| N9["<b>9 · SpintlyOauthSession.accessToken.jwtToken</b><br/>Read the Spintly token out of the session"]
        N9 --> E(["Spintly token in hand — go to step 4"])

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef fail stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 3
        class N1,N2,N3,N4,N5,N6,N7,N8,N9 sdkOauth
        class F fail
    ```

### 4. After login — seating the token

The Spintly token now goes to the two SDKs that need it, and the user's lock
permissions come down. A **returning user** with a valid saved session skips
everything above and rejoins here at `pollData`.

=== "iOS"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":500,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["Spintly token in hand"]) --> N1
        N1["<b>1 · credentialManager.isLoggedIn()</b><br/>Check before logging in again — a method on iOS"]
        N1 --> N2["<b>2 · loginStatus.appLoginState</b><br/>Check whether the SDK is logged out"]
        N2 --> N3["<b>3 · credentialManager.logIn(accessToken:)</b><br/>Log into the Access SDK"]
        N3 --> N4["<b>4 · configurationProvider.setAuthToken(token:)</b><br/>Give the Config SDK its token"]
        N4 --> N5["<b>5 · cloudSyncManager.pollData</b><br/>Pull down the user's lock permissions"]
        N5 --> E(["Home screen"])
        RU(["Returning user — saved session still valid"]) -.->|"skips steps 1–4"| N5

        classDef sdkAccess stroke:#3b82f6,stroke-width:2px
        classDef sdkConfig stroke:#f59e0b,stroke-width:2px
        class N1,N2,N3,N5 sdkAccess
        class N4 sdkConfig
    ```

=== "Android"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":500,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["Spintly token in hand"]) --> N1
        N1["<b>1 · credentialManager.isLoggedIn</b><br/>Check before logging in again — a property on Android"]
        N1 --> N2["<b>2 · credentialManager.logIn(token, CompletionCallback)</b><br/>Log into the Access SDK"]
        N2 --> N3["<b>3 · CompletionCallback&lt;Void?&gt; → completed, failed</b><br/>How the Access SDK reports the result back"]
        N3 --> N4["<b>4 · configurationProvider.setEnvironment(environment, region)</b><br/>Re-applied before the config call"]
        N4 --> N5["<b>5 · configurationProvider.setAuthToken(authToken)</b><br/>Give the Config SDK its token"]
        N5 --> N6["<b>6 · cloudSyncManager.pollData(callback)</b><br/>Pull down the user's lock permissions"]
        N6 --> E(["Home screen"])
        RU(["Returning user — saved session still valid"]) -.->|"skips steps 1–5"| N6

        classDef sdkAccess stroke:#3b82f6,stroke-width:2px
        classDef sdkConfig stroke:#f59e0b,stroke-width:2px
        class N1,N2,N3,N6 sdkAccess
        class N4,N5 sdkConfig
    ```

### 5. While logged in — what the SDK asks us for

These are the calls the app does not initiate. The SDK reaches back into the app
through the handlers registered at step 1, and the app answers.

=== "iOS"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":330,"nodeSpacing":22,"rankSpacing":28}}}%%
    flowchart TD
        S(["The Access SDK needs something"]) --> T1 & L1
        T1["<b>TokenRefreshDelegate → refreshAuthentication(completion:)</b><br/>The SDK asks us for a fresh token"]
        T1 -.->|"on token expiry"| X["<b>oauthManager.clearSession()</b><br/>Clear the OAuth session"]
        L1["<b>LoginStatusDelegate → didUpdateLoginStatus()</b><br/>The SDK tells us the login state changed"]
        L1 --> L2["<b>credentialManager.loginStatus</b><br/>Read the current login state"]
        L2 --> L3["<b>loginStatus.appLoginState</b><br/>Check whether the SDK is logged out"]
        L3 --> L4["<b>loginStatus.error</b><br/>Read the SDK's login error"]

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef sdkAccess stroke:#3b82f6,stroke-width:2px
        class X sdkOauth
        class T1,L1,L2,L3,L4 sdkAccess
    ```

=== "Android"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":420,"nodeSpacing":22,"rankSpacing":28}}}%%
    flowchart TD
        S(["The Access SDK needs something"]) --> T1
        T1["<b>credentialManager.setTokenRefreshHandler { }</b><br/>The handler registered at step 1 fires — the SDK wants a fresh token"]
        T1 -.-> F["<b>SpintlyOauthNotAuthorizedException</b><br/>The SDK's not-authorized error"]
        S --> NA["<b>No login-status handler</b><br/>Android has no equivalent of iOS's LoginStatusDelegate — nothing tells the app the SDK's login state changed"]

        classDef sdkAccess stroke:#3b82f6,stroke-width:2px
        classDef fail stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 3
        class T1 sdkAccess
        class F fail
        class NA fail
    ```

### 6. Sign out

Both platforms tear the session down the same way, in the same order: the Access
SDK's credential first, then the OAuth session.

=== "iOS"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":500,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["User signs out"]) --> N1
        N1["<b>1 · credentialManager.logOut()</b><br/>Clear the Access SDK session"]
        N1 --> N2["<b>2 · oauthManager.clearSession()</b><br/>Clear the OAuth session — also called on token expiry"]
        N2 --> E(["Signed out"])

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef sdkAccess stroke:#3b82f6,stroke-width:2px
        class N2 sdkOauth
        class N1 sdkAccess
    ```

=== "Android"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":500,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["User signs out"]) --> N1
        N1["<b>1 · credentialManager.logOut()</b><br/>Clear the Access SDK session"]
        N1 --> N2["<b>2 · oauthManager.clearSession()</b><br/>Clear the OAuth session"]
        N2 --> E(["Signed out"])

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef sdkAccess stroke:#3b82f6,stroke-width:2px
        class N2 sdkOauth
        class N1 sdkAccess
    ```

## Differences between the two

Members are shown without their receiver where both platforms share it — the
handler and login rows are all on `credentialManager`, the version row on
`configurationProvider`.

| | iOS | Android |
|---|---|---|
| Clearing the old SDK session when a new login starts | **Not done** | `logOut()` + `clearSession()` before the session is initiated |
| Token-refresh handler | `setRefreshTokenDelegate(_:)` | `setTokenRefreshHandler { }` — different name, same purpose |
| Login-status handler | `setLoginStatusDelegate(delegate:)` | **No equivalent found** |
| Session freshness check | Decodes `exp` out of the JWT itself | Uses the SDK's `isValidForThreshold` |
| Config SDK environment | Set once at app launch | Re-applied before every config call |
| Logged-in check | `isLoggedIn()` — a method | `isLoggedIn` — a property |
| SDK version logging | `getVersion()` | Not read |
