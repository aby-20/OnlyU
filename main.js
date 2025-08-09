// This script is designed to run in the global scope.
// All application logic is encapsulated in the `App` object
// to avoid polluting the global namespace.

const App = {
    // ========================
    // CONFIG & STATE
    // ========================
  config: {
    firebase: {
       apiKey: "AIzaSyA5wXboSGvB4F36LWR2zrz7XUzWbx8USq0",
      authDomain: "chat-802b8.firebaseapp.com",
      projectId: "chat-802b8",
      databaseURL: "https://chat-802b8-default-rtdb.asia-southeast1.firebasedatabase.app",
      storageBucket: "chat-802b8.firebasestorage.app",
      messagingSenderId: "511403700067",
      appId: "1:511403700067:web:51e30ae1b5d25b7718ed56",
      measurementId: "G-7GHC8RPD0T"
    },
        modelsUrl: './models',
        matchThreshold: 0.55,
    },
    
    state: {
        modelsLoaded: false,
        myIdentity: null, // { uuid, privateKey, faceDescriptor }
        currentChatPartner: null, // { uuid, publicKey }
        sharedSecretCache: {},
        messageToDecrypt: null,
        videoStream: null,
        modalVideoStream: null,
        activeChatListener: null,
    },

    // ========================
    // DOM ELEMENT REFERENCES
    // ========================
    elements: {
        setupView: document.getElementById('setup-view'),
        chatView: document.getElementById('chat-view'),
        video: document.getElementById('video'),
        canvas: document.getElementById('canvas'),
        registerBtn: document.getElementById('register-btn'),
        myUuidDisplay: document.getElementById('my-uuid'),
        logoutBtn: document.getElementById('logout-btn'),
        userList: document.getElementById('user-list'),
        chatPartnerUuidDisplay: document.getElementById('chat-partner-uuid'),
        chatWindow: document.getElementById('chat-window'),
        messageInput: document.getElementById('message-input'),
        sendBtn: document.getElementById('send-btn'),
        statusMessage: document.getElementById('statusMessage'),
        decryptModal: document.getElementById('decrypt-modal'),
        modalVideo: document.getElementById('modalVideo'),
        modalCanvas: document.getElementById('modalCanvas'),
        verifyDecryptBtn: document.getElementById('verify-decrypt-btn'),
        cancelDecryptBtn: document.getElementById('cancel-decrypt-btn'),
    },

    // ========================
    // INITIALIZATION
    // ========================
    async init() {
        // This is the main entry point of the application.
        this.addEventListeners();
        firebase.initializeApp(this.config.firebase);
        this.db = firebase.database();
        
        await this.loadModels();
        this.state.myIdentity = await this.identity.loadFromStorage();

        if (this.state.myIdentity) {
            this.ui.showChatView();
            await this.faceLogin();
        } else {
            this.ui.showSetupView();
        }
    },
    
    async loadModels() {
        this.ui.updateStatus("Loading face models...", "bg-blue-500");
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(this.config.modelsUrl),
                faceapi.nets.faceLandmark68Net.loadFromUri(this.config.modelsUrl),
                faceapi.nets.faceRecognitionNet.loadFromUri(this.config.modelsUrl)
            ]);
            this.state.modelsLoaded = true;
            this.ui.updateStatus("Models loaded.", "bg-green-500", 2000);
        } catch (e) {
            this.ui.updateStatus("Failed to load models. Check console.", "bg-red-500");
            console.error("Model loading error:", e);
        }
    },

    // ========================
    // EVENT LISTENERS
    // ========================
    addEventListeners() {
        this.elements.registerBtn.addEventListener('click', () => this.register());
        this.elements.logoutBtn.addEventListener('click', () => this.identity.logout());
        this.elements.myUuidDisplay.addEventListener('click', () => this.ui.copyMyUuid());
        this.elements.sendBtn.addEventListener('click', () => this.chat.sendMessage());
    },

    // ========================
    // UI MANAGEMENT
    // ========================
    ui: {
        showSetupView() {
            App.elements.setupView.classList.remove('hidden');
            App.elements.chatView.classList.add('hidden');
            App.video.start(App.elements.video, App.elements.canvas, 'videoStream')
               .then(() => App.elements.registerBtn.disabled = false);
        },

        showChatView() {
            App.elements.setupView.classList.add('hidden');
            App.elements.chatView.classList.remove('hidden');
            App.elements.myUuidDisplay.textContent = App.state.myIdentity.uuid;
            App.chat.listenForUsers();
        },

        updateStatus(message, bgColor, duration = 0) {
            const el = App.elements.statusMessage;
            el.textContent = message;
            el.className = `visible ${bgColor}`;
            if (duration > 0) {
                setTimeout(() => {
                    el.classList.remove('visible');
                }, duration);
            }
        },

        copyMyUuid() {
            navigator.clipboard.writeText(App.state.myIdentity.uuid)
                .then(() => App.ui.updateStatus("UUID copied!", "bg-green-500", 2000))
                .catch(() => App.ui.updateStatus("Failed to copy.", "bg-red-500", 2000));
        },
    },

    // ========================
    // REGISTRATION & LOGIN
    // ========================
    async register() {
        this.ui.updateStatus("Capturing face...", "bg-blue-500");
        const faceDescriptor = await this.face.getDescriptor(this.elements.video);
        if (!faceDescriptor) {
            this.ui.updateStatus("No face detected. Please try again.", "bg-yellow-500", 3000);
            return;
        }

        this.ui.updateStatus("Creating your secure identity...", "bg-blue-500");
        const uuid = self.crypto.randomUUID();
        const keyPair = await this.crypto.generateECDHKeyPair();
        const jwkPublicKey = await self.crypto.subtle.exportKey("jwk", keyPair.publicKey);

        const newUser = {
            faceDescriptor: Array.from(faceDescriptor),
            publicKey: jwkPublicKey,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        try {
            await this.db.ref(`users/${uuid}`).set(newUser);
            this.state.myIdentity = { uuid, privateKey: keyPair.privateKey, faceDescriptor };
            await this.identity.saveToStorage(this.state.myIdentity);
            this.ui.updateStatus("Identity created successfully!", "bg-green-500", 2000);
            this.video.stop('videoStream');
            this.ui.showChatView();
        } catch (e) {
            this.ui.updateStatus("Error saving to database.", "bg-red-500");
            console.error("Registration DB error:", e);
        }
    },

    async faceLogin() {
        this.ui.updateStatus("Please verify your face to login...", "bg-blue-500");
        const success = await this.modal.openVerification();
        if (success) {
            this.ui.updateStatus("Login successful!", "bg-green-500", 2000);
        } else {
            this.ui.updateStatus("Login failed. Refresh to try again.", "bg-red-500");
            this.elements.chatView.innerHTML = '<h1>Login Failed. Please refresh the page.</h1>';
        }
    },

    // ========================
    // IDENTITY MANAGEMENT
    // ========================
    identity: {
        async loadFromStorage() {
            const storedIdentity = localStorage.getItem('secure-chat-identity');
            if (!storedIdentity) return null;
            
            try {
                const { uuid, jwkPrivateKey, faceDescriptor } = JSON.parse(storedIdentity);
                const privateKey = await self.crypto.subtle.importKey(
                    "jwk", jwkPrivateKey, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]
                );
                return { uuid, privateKey, faceDescriptor: new Float32Array(faceDescriptor) };
            } catch (e) {
                console.error("Failed to load identity from storage:", e);
                localStorage.removeItem('secure-chat-identity'); // Clear corrupted data
                return null;
            }
        },

        async saveToStorage(identity) {
            const jwkPrivateKey = await self.crypto.subtle.exportKey("jwk", identity.privateKey);
            const storableIdentity = {
                uuid: identity.uuid,
                jwkPrivateKey,
                faceDescriptor: Array.from(identity.faceDescriptor)
            };
            localStorage.setItem('secure-chat-identity', JSON.stringify(storableIdentity));
        },

        logout() {
            localStorage.removeItem('secure-chat-identity');
            window.location.reload();
        }
    },
    
    // ========================
    // CHAT LOGIC
    // ========================
    chat: {
        listenForUsers() {
            const usersRef = App.db.ref('users');
            usersRef.on('value', snapshot => {
                App.elements.userList.innerHTML = '';
                const users = snapshot.val();
                if (!users) return;
                
                for (const uuid in users) {
                    if (uuid === App.state.myIdentity.uuid) continue;
                    const userElement = document.createElement('div');
                    userElement.textContent = `User ${uuid.substring(0, 8)}...`;
                    userElement.onclick = () => App.chat.start(uuid, users[uuid].publicKey);
                    App.elements.userList.appendChild(userElement);
                }
            });
        },

        async start(uuid, publicKey) {
            App.state.currentChatPartner = { uuid, publicKey };
            App.elements.chatPartnerUuidDisplay.textContent = uuid.substring(0, 8) + '...';
            App.elements.messageInput.disabled = false;
            App.elements.sendBtn.disabled = false;
            App.elements.chatWindow.innerHTML = '';
            
            const cacheKey = [App.state.myIdentity.uuid, uuid].sort().join('-');
            if (!App.state.sharedSecretCache[cacheKey]) {
                App.state.sharedSecretCache[cacheKey] = await App.crypto.deriveSharedSecret(App.state.myIdentity.privateKey, publicKey);
            }

            this.listenForMessages(uuid);
        },

        async sendMessage() {
            const messageText = App.elements.messageInput.value.trim();
            if (!messageText || !App.state.currentChatPartner) return;

            const cacheKey = [App.state.myIdentity.uuid, App.state.currentChatPartner.uuid].sort().join('-');
            const sharedKey = App.state.sharedSecretCache[cacheKey];
            if (!sharedKey) {
                App.ui.updateStatus("Error: No shared secret.", "bg-red-500");
                return;
            }

            const encryptedData = await App.crypto.encryptMessage(messageText, sharedKey);
            const message = {
                senderId: App.state.myIdentity.uuid,
                ...encryptedData,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            const chatId = [App.state.myIdentity.uuid, App.state.currentChatPartner.uuid].sort().join('_');
            const messagesRef = App.db.ref(`chats/${chatId}`).push();
            await messagesRef.set(message);
            App.elements.messageInput.value = '';
        },

        listenForMessages(partnerUuid) {
            const chatId = [App.state.myIdentity.uuid, partnerUuid].sort().join('_');
            const messagesRef = App.db.ref(`chats/${chatId}`).orderByChild('timestamp');
            
            if (App.state.activeChatListener) {
                App.state.activeChatListener.off(); // Detach old listener
            }
            App.state.activeChatListener = messagesRef;

            messagesRef.on('child_added', snapshot => {
                const messageData = snapshot.val();
                this.renderMessage(messageData);
            });
        },
        
        renderMessage(messageData) {
            const msgDiv = document.createElement('div');
            const content = document.createElement('p');
            msgDiv.appendChild(content);

            const isSent = messageData.senderId === App.state.myIdentity.uuid;
            msgDiv.className = `message ${isSent ? 'sent' : 'received'}`;

            if (isSent) {
                content.textContent = "You sent an encrypted message.";
            } else {
                content.textContent = "🔒 Encrypted Message. Click to decrypt.";
                msgDiv.classList.add('clickable');
                msgDiv.onclick = async () => {
                    App.state.messageToDecrypt = { data: messageData, element: content };
                    const success = await App.modal.openVerification();
                    if (success) {
                        const partnerPublicKey = (await App.db.ref(`users/${messageData.senderId}/publicKey`).once('value')).val();
                        const cacheKey = [App.state.myIdentity.uuid, messageData.senderId].sort().join('-');
                        if (!App.state.sharedSecretCache[cacheKey]) {
                            App.state.sharedSecretCache[cacheKey] = await App.crypto.deriveSharedSecret(App.state.myIdentity.privateKey, partnerPublicKey);
                        }
                        const sharedKey = App.state.sharedSecretCache[cacheKey];
                        const decryptedText = await App.crypto.decryptMessage(messageData, sharedKey);
                        content.textContent = decryptedText;
                        msgDiv.classList.add('decrypted');
                        msgDiv.onclick = null; // Disable further clicks
                    } else {
                        App.ui.updateStatus("Verification failed. Cannot decrypt.", "bg-red-500", 3000);
                    }
                };
            }
            App.elements.chatWindow.appendChild(msgDiv);
            App.elements.chatWindow.scrollTop = App.elements.chatWindow.scrollHeight;
        }
    },
    
    // ========================
    // VIDEO & FACE-API
    // ========================
    video: {
        async start(videoEl, canvasEl, streamStateKey) {
            if (App.state[streamStateKey]) return;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
                App.state[streamStateKey] = stream;
                videoEl.srcObject = stream;
                return new Promise(resolve => {
                    videoEl.onloadedmetadata = () => {
                        faceapi.matchDimensions(canvasEl, { width: videoEl.videoWidth, height: videoEl.videoHeight });
                        resolve();
                    };
                });
            } catch (e) {
                App.ui.updateStatus("Webcam access denied.", "bg-red-500");
                console.error("Webcam error:", e);
            }
        },
        stop(streamStateKey) {
            const stream = App.state[streamStateKey];
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                App.state[streamStateKey] = null;
            }
        }
    },
    
    face: {
        async getDescriptor(videoEl) {
            return await faceapi.detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        }
    },

    // ========================
    // DECRYPTION MODAL
    // ========================
    modal: {
        openVerification() {
            return new Promise(async (resolve) => {
                App.elements.decryptModal.classList.remove('hidden');
                await App.video.start(App.elements.modalVideo, App.elements.modalCanvas, 'modalVideoStream');

                const verifyHandler = async () => {
                    const detection = await App.face.getDescriptor(App.elements.modalVideo);
                    if (detection) {
                        const distance = faceapi.euclideanDistance(App.state.myIdentity.faceDescriptor, detection.descriptor);
                        cleanupAndResolve(distance < App.config.matchThreshold);
                    } else {
                        App.ui.updateStatus("No face detected.", "bg-yellow-500", 2000);
                        cleanupAndResolve(false);
                    }
                };
                
                const cancelHandler = () => cleanupAndResolve(false);

                const cleanupAndResolve = (result) => {
                    App.elements.verifyDecryptBtn.removeEventListener('click', verifyHandler);
                    App.elements.cancelDecryptBtn.removeEventListener('click', cancelHandler);
                    App.video.stop('modalVideoStream');
                    App.elements.decryptModal.classList.add('hidden');
                    resolve(result);
                };

                App.elements.verifyDecryptBtn.addEventListener('click', verifyHandler);
                App.elements.cancelDecryptBtn.addEventListener('click', cancelHandler);
            });
        }
    },

    // ========================
    // CRYPTO UTILITIES
    // ========================
    crypto: {
        async generateECDHKeyPair() {
            return await self.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
        },
        async deriveSharedSecret(privateKey, publicKey) {
            const publicCryptoKey = await self.crypto.subtle.importKey("jwk", publicKey, { name: "ECDH", namedCurve: "P-256" }, true, []);
            return await self.crypto.subtle.deriveKey({ name: "ECDH", public: publicCryptoKey }, privateKey, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        },
        async encryptMessage(message, sharedKey) {
            const iv = self.crypto.getRandomValues(new Uint8Array(12));
            const encodedMessage = new TextEncoder().encode(message);
            const ciphertext = await self.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, sharedKey, encodedMessage);
            const toBase64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)));
            return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
        },
        async decryptMessage(encryptedData, sharedKey) {
            try {
                const fromBase64 = base64 => new Uint8Array(atob(base64).split("").map(c => c.charCodeAt(0)));
                const decryptedBuffer = await self.crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(encryptedData.iv) }, sharedKey, fromBase64(encryptedData.ciphertext));
                return new TextDecoder().decode(decryptedBuffer);
            } catch (e) {
                console.error("Decryption failed:", e);
                return "Decryption Failed.";
            }
        }
    }
};

// Start the application once the DOM is fully loaded.
window.addEventListener('DOMContentLoaded', () => App.init());
