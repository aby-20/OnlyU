// ========================
// DOM ELEMENT REFERENCES
// ========================
const setupView = document.getElementById('setup-view');
const chatView = document.getElementById('chat-view');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const registerBtn = document.getElementById('register-btn');
const myUuidDisplay = document.getElementById('my-uuid');
const copyUuidBtn = document.getElementById('copy-uuid-btn');
const userList = document.getElementById('user-list');
const chatPartnerUuidDisplay = document.getElementById('chat-partner-uuid');
const chatWindow = document.getElementById('chat-window');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const statusMessage = document.getElementById('statusMessage');

// Modal Elements
const decryptModal = document.getElementById('decrypt-modal');
const modalVideo = document.getElementById('modalVideo');
const modalCanvas = document.getElementById('modalCanvas');
const verifyDecryptBtn = document.getElementById('verify-decrypt-btn');
const cancelDecryptBtn = document.getElementById('cancel-decrypt-btn');

// ========================
// FIREBASE CONFIGURATION
// ========================
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA5wXboSGvB4F36LWR2zrz7XUzWbx8USq0",
  authDomain: "chat-802b8.firebaseapp.com",
  projectId: "chat-802b8",
  storageBucket: "chat-802b8.firebasestorage.app",
  messagingSenderId: "511403700067",
  appId: "1:511403700067:web:51e30ae1b5d25b7718ed56",
  measurementId: "G-7GHC8RPD0T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// ========================
// APP STATE & GLOBALS
// ========================
const MODEL_URL = './models';
const MATCH_THRESHOLD = 0.5;
let modelsLoaded = false;
let myIdentity = null; // { uuid, privateKey, faceDescriptor }
let currentChatPartner = null; // { uuid, publicKey }
let sharedSecretCache = {}; // Cache for derived shared secrets
let messageToDecrypt = null;
let videoStream, modalVideoStream;

// ========================
// CRYPTO HELPERS
// ========================

const cryptoUtils = {
    // Generate a new v4 UUID
    generateUUID: () => crypto.randomUUID(),

    // Generate an ECDH key pair for Diffie-Hellman
    generateECDHKeyPair: async () => {
        return await crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey"]
        );
    },

    // Derive a shared secret key from my private key and their public key
    deriveSharedSecret: async (privateKey, publicKey) => {
        const publicCryptoKey = await crypto.subtle.importKey(
            "jwk", publicKey, { name: "ECDH", namedCurve: "P-256" }, true, []
        );
        return await crypto.subtle.deriveKey(
            { name: "ECDH", public: publicCryptoKey },
            privateKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    },

    // Encrypt a message using a shared secret
    encryptMessage: async (message, sharedKey) => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedMessage = new TextEncoder().encode(message);
        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            sharedKey,
            encodedMessage
        );
        return {
            ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))), // Base64 encode
            iv: btoa(String.fromCharCode(...new Uint8Array(iv)))
        };
    },

    // Decrypt a message using a shared secret
    decryptMessage: async (encryptedData, sharedKey) => {
        try {
            const iv = new Uint8Array(atob(encryptedData.iv).split("").map(c => c.charCodeAt(0)));
            const ciphertext = new Uint8Array(atob(encryptedData.ciphertext).split("").map(c => c.charCodeAt(0)));
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                sharedKey,
                ciphertext
            );
            return new TextDecoder().decode(decryptedBuffer);
        } catch (e) {
            console.error("Decryption failed:", e);
            return "Decryption Failed. Key might be incorrect.";
        }
    }
};

// ========================
// INITIALIZATION & SETUP
// ========================

async function main() {
    await loadModels();
    myIdentity = await loadIdentityFromStorage();

    if (myIdentity) {
        showChatView();
        await faceLogin();
    } else {
        showSetupView();
    }
}

async function loadModels() {
    updateStatus("Loading face models...", "bg-blue-500");
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
        updateStatus("Models loaded.", "bg-green-500", 2000);
    } catch (e) {
        updateStatus("Failed to load models.", "bg-red-500");
        console.error(e);
    }
}

async function loadIdentityFromStorage() {
    const storedIdentity = localStorage.getItem('secure-chat-identity');
    if (!storedIdentity) return null;
    const { uuid, jwkPrivateKey, faceDescriptor } = JSON.parse(storedIdentity);
    const privateKey = await crypto.subtle.importKey(
        "jwk", jwkPrivateKey, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]
    );
    return { uuid, privateKey, faceDescriptor: new Float32Array(faceDescriptor) };
}

async function saveIdentityToStorage(identity) {
    const jwkPrivateKey = await crypto.subtle.exportKey("jwk", identity.privateKey);
    const storableIdentity = {
        uuid: identity.uuid,
        jwkPrivateKey,
        faceDescriptor: Array.from(identity.faceDescriptor)
    };
    localStorage.setItem('secure-chat-identity', JSON.stringify(storableIdentity));
}

// ========================
// UI FLOW MANAGEMENT
// ========================

function showSetupView() {
    setupView.classList.remove('hidden');
    chatView.classList.add('hidden');
    startVideoStream(video, canvas).then(() => registerBtn.disabled = false);
}

function showChatView() {
    setupView.classList.add('hidden');
    chatView.classList.remove('hidden');
    myUuidDisplay.textContent = myIdentity.uuid;
    listenForUsers();
}

async function faceLogin() {
    updateStatus("Please verify your face to login...", "bg-blue-500");
    const success = await openVerificationModal();
    if (success) {
        updateStatus("Login successful!", "bg-green-500", 2000);
    } else {
        updateStatus("Login failed. Refresh to try again.", "bg-red-500");
        // In a real app, you might lock the UI here.
    }
}

// ========================
// REGISTRATION
// ========================

registerBtn.addEventListener('click', async () => {
    updateStatus("Capturing face...", "bg-blue-500");
    const faceDescriptor = await getFaceDescriptor(video);
    if (!faceDescriptor) {
        updateStatus("No face detected. Please try again.", "bg-yellow-500", 3000);
        return;
    }

    updateStatus("Creating your secure identity...", "bg-blue-500");
    const uuid = cryptoUtils.generateUUID();
    const keyPair = await cryptoUtils.generateECDHKeyPair();
    const jwkPublicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

    const newUser = {
        faceDescriptor: Array.from(faceDescriptor),
        publicKey: jwkPublicKey,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        await database.ref(`users/${uuid}`).set(newUser);
        myIdentity = { uuid, privateKey: keyPair.privateKey, faceDescriptor };
        await saveIdentityToStorage(myIdentity);
        updateStatus("Identity created successfully!", "bg-green-500", 2000);
        stopVideoStream(video);
        showChatView();
    } catch (e) {
        updateStatus("Error saving to database.", "bg-red-500");
        console.error(e);
    }
});

// ========================
// CHAT FUNCTIONALITY
// ========================

function listenForUsers() {
    const usersRef = database.ref('users');
    usersRef.on('value', snapshot => {
        userList.innerHTML = '';
        const users = snapshot.val();
        for (const uuid in users) {
            if (uuid === myIdentity.uuid) continue;
            const userElement = document.createElement('div');
            userElement.className = 'p-2 border rounded-lg hover:bg-gray-100 cursor-pointer';
            userElement.textContent = `User ${uuid.substring(0, 8)}...`;
            userElement.onclick = () => startChat(uuid, users[uuid].publicKey);
            userList.appendChild(userElement);
        }
    });
}

async function startChat(uuid, publicKey) {
    currentChatPartner = { uuid, publicKey };
    chatPartnerUuidDisplay.textContent = uuid;
    messageInput.disabled = false;
    sendBtn.disabled = false;
    chatWindow.innerHTML = `<p class="text-gray-400 text-center">Chatting with ${uuid.substring(0,8)}...</p>`;
    
    // Derive and cache the shared secret
    const cacheKey = [myIdentity.uuid, uuid].sort().join('-');
    if (!sharedSecretCache[cacheKey]) {
        sharedSecretCache[cacheKey] = await cryptoUtils.deriveSharedSecret(myIdentity.privateKey, publicKey);
    }

    listenForMessages(uuid);
}

sendBtn.addEventListener('click', async () => {
    const messageText = messageInput.value.trim();
    if (!messageText || !currentChatPartner) return;

    const cacheKey = [myIdentity.uuid, currentChatPartner.uuid].sort().join('-');
    const sharedKey = sharedSecretCache[cacheKey];
    if (!sharedKey) {
        updateStatus("Error: No shared secret.", "bg-red-500");
        return;
    }

    const encryptedData = await cryptoUtils.encryptMessage(messageText, sharedKey);
    const message = {
        senderId: myIdentity.uuid,
        ...encryptedData,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    const chatId = [myIdentity.uuid, currentChatPartner.uuid].sort().join('_');
    const messagesRef = database.ref(`chats/${chatId}`).push();
    await messagesRef.set(message);
    messageInput.value = '';
});

function listenForMessages(partnerUuid) {
    const chatId = [myIdentity.uuid, partnerUuid].sort().join('_');
    const messagesRef = database.ref(`chats/${chatId}`).orderByChild('timestamp');
    
    messagesRef.on('child_added', snapshot => {
        const messageData = snapshot.val();
        renderMessage(messageData);
    });
}

function renderMessage(messageData) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `p-3 rounded-lg mb-2 max-w-xs message ${messageData.senderId === myIdentity.uuid ? 'bg-blue-100 ml-auto' : 'bg-gray-200 mr-auto'}`;
    
    const content = document.createElement('p');
    content.className = "text-sm break-words";
    content.textContent = "🔒 Encrypted Message. Click to decrypt.";
    msgDiv.appendChild(content);

    msgDiv.onclick = async () => {
        // Prevent decryption of own messages
        if (messageData.senderId === myIdentity.uuid) {
            updateStatus("You can't decrypt your own sent messages this way.", "bg-yellow-500", 3000);
            return;
        }

        messageToDecrypt = { data: messageData, element: content };
        const success = await openVerificationModal();
        if (success) {
            const partnerPublicKey = (await database.ref(`users/${messageData.senderId}/publicKey`).once('value')).val();
            const cacheKey = [myIdentity.uuid, messageData.senderId].sort().join('-');
            if (!sharedSecretCache[cacheKey]) {
                sharedSecretCache[cacheKey] = await cryptoUtils.deriveSharedSecret(myIdentity.privateKey, partnerPublicKey);
            }
            const sharedKey = sharedSecretCache[cacheKey];
            const decryptedText = await cryptoUtils.decryptMessage(messageData, sharedKey);
            content.textContent = decryptedText;
            msgDiv.onclick = null; // Disable further clicks
            msgDiv.classList.add('bg-green-100');
        } else {
            updateStatus("Verification failed. Cannot decrypt.", "bg-red-500", 3000);
        }
    };
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}


// ========================
// VIDEO & FACE-API
// ========================

async function startVideoStream(videoEl, canvasEl) {
    if (videoEl.srcObject) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        videoEl.srcObject = stream;
        if (videoEl.id === 'video') videoStream = stream;
        else modalVideoStream = stream;
        
        return new Promise(resolve => {
            videoEl.onloadedmetadata = () => {
                faceapi.matchDimensions(canvasEl, { width: videoEl.videoWidth, height: videoEl.videoHeight });
                resolve();
            };
        });
    } catch (e) {
        updateStatus("Webcam access denied.", "bg-red-500");
        console.error(e);
    }
}

function stopVideoStream(videoEl) {
    let stream = videoEl.id === 'video' ? videoStream : modalVideoStream;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoEl.srcObject = null;
        if (videoEl.id === 'video') videoStream = null;
        else modalVideoStream = null;
    }
}

async function getFaceDescriptor(videoEl) {
    return await faceapi.detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
}


// ========================
// DECRYPTION MODAL
// ========================

function openVerificationModal() {
    return new Promise(async (resolve) => {
        decryptModal.classList.remove('hidden');
        await startVideoStream(modalVideo, modalCanvas);

        const verifyHandler = async () => {
            const detection = await getFaceDescriptor(modalVideo);
            if (detection) {
                const distance = faceapi.euclideanDistance(myIdentity.faceDescriptor, detection.descriptor);
                if (distance < MATCH_THRESHOLD) {
                    cleanupAndResolve(true);
                } else {
                    updateStatus("Face does not match.", "bg-red-500", 2000);
                    cleanupAndResolve(false);
                }
            } else {
                updateStatus("No face detected for verification.", "bg-yellow-500", 2000);
                cleanupAndResolve(false);
            }
        };

        const cancelHandler = () => cleanupAndResolve(false);

        const cleanupAndResolve = (result) => {
            verifyDecryptBtn.removeEventListener('click', verifyHandler);
            cancelDecryptBtn.removeEventListener('click', cancelHandler);
            stopVideoStream(modalVideo);
            decryptModal.classList.add('hidden');
            resolve(result);
        };

        verifyDecryptBtn.addEventListener('click', verifyHandler);
        cancelDecryptBtn.addEventListener('click', cancelHandler);
    });
}

// ========================
// UTILITIES
// ========================

function updateStatus(message, bgColor, duration = 0) {
    statusMessage.textContent = message;
    statusMessage.className = `text-white font-medium p-3 rounded-lg shadow-lg transition-opacity duration-500 opacity-100 ${bgColor}`;
    if (duration > 0) {
        setTimeout(() => {
            statusMessage.classList.remove('opacity-100');
        }, duration);
    }
}

copyUuidBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(myIdentity.uuid)
        .then(() => updateStatus("UUID copied to clipboard!", "bg-green-500", 2000))
        .catch(() => updateStatus("Failed to copy UUID.", "bg-red-500", 2000));
});


// ========================
// START THE APP
// ========================
main();
