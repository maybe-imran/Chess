# Security Specification: Chess Application

This document defines the zero-trust security specification for the Chess game application's Firebase Firestore database. It details the strict data invariants, malicious attack vector payloads, and the logical validation rules required to lock down access.

## I. Data Invariants

### 1. User Profiles (`/users/{userId}`)
* **Identity Lock**: A user profile document can only be created, modified, or deleted by the authenticated user whose `request.auth.uid` matches the `{userId}` path parameter.
* **Immutability of Age**: The `createdAt` attribute must be immutable after creation and must match standard server timestamping values.
* **Data Limits**: The display name/username must be limited in length between 3 and 50 characters to prevent database memory attacks.

### 2. Matchmaking Queue (`/matchmaking_queue/{userId}`)
* **One Ticket Per User**: Matches `{userId}` parameter to `request.auth.uid`. A user cannot register matchmaking tickets on behalf of other players.
* **Integrity of Candidate Transitions**: A third-party player can only update an opponent's queue status if the opponent's previous state was `'waiting'`, the new state is `'matched'`, and `matchedWith` is securely bound to the matching user's authenticated ID.

### 3. Online Game Rooms (`/rooms/{roomId}`)
* **Participant Authorization**: Only players registered as `whitePlayerId` or `blackPlayerId` are authorized to update game boards, play moves, send heartbeats, or post chat messages.
* **Rule-Based Move Ownership**: A player can only write to the FEN attribute, move count, and history arrays. Turn transitions must be protected by ensuring only participants can update status.
* **Chat Message Appends**: Chat messages must be appended inside a bounded list. Out-of-bounds user identity injection is forbidden.

---

## II. The "Dirty Dozen" Malicious Payloads

The following 12 attack payloads are designed to probe for update gaps or lax database constraints:

### Attack Vector 1: User Profile Spoofing
An attacker tries to register an account using another player's credential.
* **Payload**:
  ```json
  {
    "uid": "victim_uid_abc123",
    "username": "impostor_grandmaster",
    "createdAt": 1718870420000,
    "statsPlaceholder": { "gamesPlayed": 100, "gamesWon": 100, "gamesLost": 0, "gamesDrawn": 0 }
  }
  ```
* **Target Path**: `/users/victim_uid_abc123`
* **Expected Result**: `PERMISSION_DENIED` (auth.uid mismatch).

### Attack Vector 2: User Profile Mass-Overwriting (Ghost Field Injection)
An attacker attempts to inject privileged fields like `isAdmin` to gain administrative access.
* **Payload**:
  ```json
  {
    "uid": "attacker_uid_456",
    "username": "malicious_user",
    "createdAt": 1718870420000,
    "statsPlaceholder": { "gamesPlayed": 0, "gamesWon": 0, "gamesLost": 0, "gamesDrawn": 0 },
    "isAdmin": true
  }
  ```
* **Target Path**: `/users/attacker_uid_456`
* **Expected Result**: `PERMISSION_DENIED` (Ghost fields blocked by strict size count check).

### Attack Vector 3: Queue Hijacking
An attacker attempts to cancel or remove another player's matchmaking ticket.
* **Payload**: `DELETE` request by `attacker_uid` targeting `/matchmaking_queue/victim_uid`.
* **Expected Result**: `PERMISSION_DENIED` (owner ID mismatch).

### Attack Vector 4: Matchmaker Spoofing (Shortcut Pairing)
An attacker modifies another user's ticket to `'matched'` without assigning them to themselves, leaving them in an invalid state.
* **Payload**:
  ```json
  {
    "userId": "victim_uid",
    "username": "victim_player",
    "status": "matched",
    "matchedWith": "some_arbitrary_third_party",
    "roomId": "ABCDEF"
  }
  ```
* **Target Path**: `/matchmaking_queue/victim_uid` (sent by attacker)
* **Expected Result**: `PERMISSION_DENIED` (`matchedWith` must equal the caller's auth.uid).

### Attack Vector 5: Room Hijack / Overwrite
An attacker attempts to overwrite an ongoing room to instantly crown themselves the winner.
* **Payload**:
  ```json
  {
    "roomId": "ROOM99",
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "whitePlayerId": "attacker_uid",
    "blackPlayerId": "victim_uid",
    "status": "gameover",
    "creatorId": "attacker_uid",
    "resignedColor": "b",
    "moveCount": 99
  }
  ```
* **Target Path**: `/rooms/ROOM99`
* **Expected Result**: `PERMISSION_DENIED` (overwriting existing rooms is blocked).

### Attack Vector 6: Illicit Move Injection / Turn Stealing
Black player attempts to rewrite the board during White's active turn.
* **Payload**:
  ```json
  {
    "fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    "moveCount": 1,
    "lastMove": { "from": "e2", "to": "e4", "timestamp": 1718870490000 }
  }
  ```
* **Target Path**: `/rooms/ROOM99` (submitted by Black while FEN turn says `w`)
* **Expected Result**: `PERMISSION_DENIED` (turn enforcement mismatch).

### Attack Vector 7: Ghost Chat Impersonation
An attacker tries to post a chat message inside an active room pretending to be the opponent.
* **Payload**:
  ```json
  {
    "messages": [
      {
        "id": "msg_999",
        "senderId": "victim_uid",
        "senderName": "Victim",
        "senderColor": "w",
        "text": "I resign, you win!",
        "timestamp": 1718870500000
      }
    ]
  }
  ```
* **Target Path**: `/rooms/ROOM12` (submitted by attacker)
* **Expected Result**: `PERMISSION_DENIED` (auth.uid must match the appended chat message senderId).

### Attack Vector 8: Infinite Chat List Exhaustion
An attacker attempts to write an array of 5,000 messages at once to cause client memory crashes.
* **Target Path**: `/rooms/ROOM12`
* **Expected Result**: `PERMISSION_DENIED` (array limits on `messages` size strictly bounded to <= 1000).

### Attack Vector 9: PII Address Leakage
A normal signed-in player attempts to query list all users to leak private user metadata.
* **Target Path**: `/users` (list request)
* **Expected Result**: `PERMISSION_DENIED` (secured list checks prevent broad scraping).

### Attack Vector 10: State Bypass / Reset Hack
An attacker tries to reset an active, ready game back to `'waiting'` status.
* **Payload**:
  ```json
  {
    "status": "waiting",
    "whitePlayerId": null
  }
  ```
* **Target Path**: `/rooms/ROOM12` (ongoing match)
* **Expected Result**: `PERMISSION_DENIED` (terminal updates and transitions from `'ready'` back to `'waiting'` are blocked).

### Attack Vector 11: Denial of Wallet (DOW) Character Spams
An attacker injects a 300KB alphanumeric room code string to cause massive indexing and search costs.
* **Target Path**: `/rooms/SOME_300KB_STRING`
* **Expected Result**: `PERMISSION_DENIED` (IDs must match regex '^[a-zA-Z0-9_\-]+$' and length requirements).

### Attack Vector 12: Timestamp Spoofing (Clock Manipulation)
An attacker registers an account with a custom date spoofing a signup 5 years in the past.
* **Payload**:
  ```json
  {
    "uid": "attacker_uid",
    "username": "backtothefuture",
    "createdAt": 1418870400000,
    "statsPlaceholder": { "gamesPlayed": 0, "gamesWon": 0, "gamesLost": 0, "gamesDrawn": 0 }
  }
  ```
* **Target Path**: `/users/attacker_uid`
* **Expected Result**: `PERMISSION_DENIED` (createdAt timestamp must equal request server time).

---

## III. Verification Spec Dry-Run

The verification specs guarantee that:
1. `request.auth != null` is evaluated first to stop unauthenticated malicious scripts (DOW saving).
2. `isValidId` and type check filters run synchronously.
3. Logical gates compare states transition bounds before database write validation.
