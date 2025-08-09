<img width="400" height="400" alt="useless2 0-2" src="https://github.com/user-attachments/assets/ffcdd9e0-3350-46d2-a5cf-9a731d35ba51" />


# Only U


## Basic Details
### Team Name: Ready Aavatha Project


### Team Members
- Member 1: Aby Syril - Cochin University College of Engineering Kuttanad.
- Member 2: Alen Elias Cherian - Cochin University College of Engineering Kuttanad.
### Project Description
Welcome to the pinnacle of over-engineering — Only U. A revolutionary messaging app for people who thought normal chats were way too easy. Why type a message and just send it, when you can add an entire facial data verification system in between?

Here’s how it works: Before you can send or read a message, the app stares deeply into your soul (well, your webcam) and confirms you’re you. It uses face-api.js, because if we’re going to make it useless, we might as well make it unnecessarily high-tech. Then it encrypts everything using fancy Diffie-Hellman keys that neither you nor the other person will ever understand.

Messages remain fully encrypted gibberish until you once again prove your face hasn’t dramatically changed since the last selfie. Oh, and we store all this securely in Firebase, because what’s a useless project without a cloud database?
<img width="1249" height="854" alt="useless2 0-1" src="https://github.com/user-attachments/assets/3b40075c-496a-46cf-85fe-e6ff79c3397d" />

### The Problem (that doesn't exist)
Tired of having no chat app of your own and that others sneaks into your chat when u try to have ..uhm...private chats.

### The Solution (that nobody asked for)
Because the difference between a professional and amateur is that he builds his own chat app - that too with facial authentication with deffie hellmann key exchange encryption strategy

## Technical Details
### Technologies/Components Used
For Software:

Frontend
  -HTML5,JavaScript
  -CSS3 for styling
libraries used
 - face-api.js library used for computer vision tasks
 - SsdMobilenvtv1 - to find faces in the live video feed
 - FaceMatcher - to cross verify the stored and live picture feed.
Backend
  - Firebase SDK - Realtime database to store encrypted messages.
APIs Used
  -Web Crypto API - ECDH(Elliptic Curve Diffie-Hellman) - to share the secret key between two users  without sending key over the network.
  -AES-GCM - for encrytpting and decrypting messages with the shared key.
  -crypto.randomUUID - to generate unique user ID.
  -WebRTC(getUSerMedia)-to access user's camera and stream live video feed into the app.



### Implementation

 Static Web App hosted using github static pages
### Project Documentation

# Screenshots 
<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/9171d390-c646-4513-af10-a4f6ba3dc27e" />
Registering Facial data to get the Unique user id


<img width="1919" height="995" alt="image" src="https://github.com/user-attachments/assets/fcdad205-fe1a-40ea-9bdd-b71094a1e4bf" />
the chat interface. type the user id in the typebox to start the chat with the user.


<img width="971" height="651" alt="image" src="https://github.com/user-attachments/assets/d6bc6e38-e6e1-43ad-922c-0d0d8d52de89" />

<img width="932" height="782" alt="image" src="https://github.com/user-attachments/assets/c6c94e38-4faa-4e48-b566-d1258f23cb2e" />

<img width="987" height="661" alt="image" src="https://github.com/user-attachments/assets/67c87cf2-a893-406a-8899-a3dbaabe84bb" />

# Diagrams
```
Part 1 - New User Registration
+---------------------------------+
|   Start: New User Opens App     |
+---------------------------------+
                 |
                 v
+---------------------------------+
|   Check Browser for Saved ID    |
+---------------------------------+
                 |
     +-----------+-----------+
     |                       |
     v                       v
+-----------------+   +----------------------+
|  ID Not Found   |   |      ID Found        |
+-----------------+   +----------------------+
     |                       |
     v                       |
+-----------------+          |
| Generate New ID |          |
+-----------------+          |
     |                       |
     v                       |
+-----------------+          |
|  Save ID to     |          |
|  Browser        |          |
+-----------------+          |
     |                       |
     +-----------+-----------+
                 |
                 v
+---------------------------------+
|    Show Face Scan Interface     |
+---------------------------------+
                 |
                 v
+---------------------------------+
|  User Starts 3-Second Scan      |
+---------------------------------+
                 |
                 v
+---------------------------------+
|   Scan & Collect Face Samples   |
+---------------------------------+
                 |
                 v
+---------------------------------+
|     Generate Crypto Key Pair    |
|      (Public and Private)       |
+---------------------------------+
                 |
     +-----------+-----------+
     |                       |
     v                       v
+-----------------+   +----------------------+
| Save to Firebase|   | Save to Local Browser|
| - Public Key    |   | - Private Key        |
| - Face Profile  |   | - Face Matcher       |
+-----------------+   +----------------------+
     |                       |
     +-----------+-----------+
                 |
                 v
+---------------------------------+
|    Show Main Chat Application   |
+---------------------------------+
                 |
                 v
+---------------------------------+
|              End                |
+---------------------------------+







Part 2: End-to-End Encrypted Messaging
+---------------------------------+      +-----------------------------+      +-----------------------------+
|          SENDER (USER A)        |      |       FIREBASE SERVER       |      |      RECIPIENT (USER B)     |
+---------------------------------+      +-----------------------------+      +-----------------------------+
                 |                                                                           |
                 v                                                                           |
+---------------------------------+                                                          |
|  Selects User B to Chat With    |                                                          |
+---------------------------------+                                                          |
                 |                                                                           |
                 v                                                                           |
+---------------------------------+                                                          |
| Fetches B's Public Key from DB  |                                                          |
+---------------------------------+                                                          |
                 |                                                                           |
                 v                                                                           |
+---------------------------------+                                                          |
|   Derives Shared Secret Key     |                                                          |
+---------------------------------+                                                          |
                 |                                                                           |
                 v                                                                           |
+---------------------------------+                                                          |
|    Encrypts Message with Key    |                                                          |
+---------------------------------+                                                          |
                 |                                                                           |
                 +------------------------>+-----------------------------+                    |
                                         |   Stores Encrypted Message  |                    |
                                         +-----------------------------+<--------------------+
                                                        |
                                                        v
                                         +-----------------------------+
                                         |   Notifies Recipient App    |
                                         +-----------------------------+
                                                        |
                                                        +------------------------------------>+
                                                                                             |
                                                                                             v
                                                                             +-----------------------------+
                                                                             |  User B Clicks to Decrypt   |
                                                                             +-----------------------------+
                                                                                             |
                                                                                             v
                                                                             +-----------------------------+
                                                                             |   Verifies Face to Unlock   |
                                                                             +-----------------------------+
                                                                                             |
                                                                                             v
                                                                             +-----------------------------+
                                                                             |  Derives Shared Secret Key  |
                                                                             +-----------------------------+
                                                                                             |
                                                                                             v
                                                                             +-----------------------------+
                                                                             |   Decrypts Message with Key |
                                                                             +-----------------------------+
                                                                                             |
                                                                                             v
                                                                             +-----------------------------+
                                                                             | Displays Understandable Message |
                                                                             +-----------------------------+
                                                                                             |
                                                                                             v
                                                                             +-----------------------------+
                                                                             |             End             |
                                                                             +-----------------------------+  i wanna include this workflow inside a readme.md. show do i display this just like thos

```



### Project Demo
# Video


https://github.com/user-attachments/assets/71bc784f-c42f-42eb-acca-b51a7e6ea14d





## Team Contributions
- [Name 1]: [Specific contributions]
- [Name 2]: [Specific contributions]


## Host Web



---
Made with ❤️ at TinkerHub Useless Projects 

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--25-25?link=https%3A%2F%2Fwww.tinkerhub.org%2Fevents%2FQ2Q1TQKX6Q%2FUseless%2520Projects)
