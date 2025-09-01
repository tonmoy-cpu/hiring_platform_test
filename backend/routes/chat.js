const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Application = require('../models/Application');
const multer = require('multer'); // Import multer
const path = require('path'); // Import path for file extensions

// Configure Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Files will be stored in the 'uploads/' directory
    },
    filename: function (req, file, cb) {
        // Use a unique filename to prevent collisions
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// File filter to accept only specific mime types (optional, but good practice)
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type, only JPEG, PNG, or PDF is allowed!'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// POST /api/chat/:applicationId - Send a message
// Use upload.single('attachment') middleware for file uploads
router.post('/:applicationId', auth, upload.single('attachment'), async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { content } = req.body; // Multer parses text fields into req.body
        const senderId = req.user.id;
        const attachment = req.file; // Multer makes file info available in req.file

        console.log("--- BACKEND DEBUG: POST /api/chat/:applicationId received.");
        console.log("--- BACKEND DEBUG: applicationId from params:", applicationId);
        console.log("--- BACKEND DEBUG: content from body (raw):", content); // Now should contain text if sent
        console.log("--- BACKEND DEBUG: attachment from req.file:", attachment); // Should contain file info if uploaded
        console.log("--- BACKEND DEBUG: senderId from token:", senderId);

        let chat = await Chat.findOne({ application: applicationId });

        if (!chat) {
            console.log("--- BACKEND DEBUG: Chat not found for application. Attempting to create new chat.");
            const application = await Application.findById(applicationId);
            if (!application) {
                console.error("--- BACKEND ERROR: Application not found for ID:", applicationId);
                return res.status(404).json({ msg: 'Application not found' });
            }

            let recipientId;
            if (application.candidate.toString() === senderId) {
                recipientId = application.recruiter.toString();
                console.log("--- BACKEND DEBUG: Sender is candidate, recipient is recruiter:", recipientId);
            } else if (application.recruiter.toString() === senderId) {
                recipientId = application.candidate.toString();
                console.log("--- BACKEND DEBUG: Sender is recruiter, recipient is candidate:", recipientId);
            } else {
                console.error("--- BACKEND ERROR: Sender is not a participant in this application.");
                return res.status(403).json({ msg: 'Not a participant in this application' });
            }

            chat = new Chat({
                application: applicationId,
                participants: [senderId, recipientId],
                messages: []
            });
            await chat.save();
            console.log("--- BACKEND DEBUG: New chat created:", chat._id);
        } else {
            console.log("--- BACKEND DEBUG: Existing chat found for application:", chat._id);
        }

        // Ensure content is a string, even if empty or not provided in request body
        const messageContent = typeof content === 'string' ? content : '';

        // Validate that either content or an attachment is present
        if (!messageContent.trim() && !attachment) {
            console.error("--- BACKEND ERROR: Message content is required or an attachment must be provided.");
            return res.status(400).json({ msg: 'Message content or attachment is required.' });
        }

        const newMessage = {
            sender: senderId,
            content: messageContent,
            timestamp: new Date(),
            attachment: attachment ? `/uploads/${attachment.filename}` : undefined,
            attachmentType: attachment ? attachment.mimetype : undefined
        };

        chat.messages.push(newMessage);
        await chat.save();
        console.log("--- BACKEND DEBUG: Message saved to chat DB.");

        const savedMessage = chat.messages[chat.messages.length - 1];

        const senderUser = await User.findById(savedMessage.sender).select('username');
        const messageToEmit = {
            _id: savedMessage._id.toString(),
            chatId: chat._id.toString(),
            sender: savedMessage.sender.toString(),
            senderUsername: senderUser ? senderUser.username : 'Unknown User',
            content: savedMessage.content,
            timestamp: savedMessage.timestamp,
            attachment: savedMessage.attachment,
            attachmentType: savedMessage.attachmentType
        };

        const io = req.app.get('io');
        if (io) {
            io.to(chat._id.toString()).emit('message', messageToEmit);
            console.log(`--- BACKEND DEBUG: Message emitted to chat room ${chat._id}:`, messageToEmit);
        } else {
            console.warn("--- BACKEND WARNING: Socket.IO instance not found on app object.");
        }

        res.json(messageToEmit);
    } catch (err) {
        console.error("--- BACKEND ERROR: Error sending message:", err.message);
        // Handle multer errors specifically
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ msg: `File upload error: ${err.message}` });
        } else if (err.message.includes('Invalid file type')) {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).send('Server Error: ' + err.message);
    }
});

// GET /api/chat/:applicationId - Get chat history
router.get('/:applicationId', auth, async (req, res) => {
    try {
        const applicationId = req.params.applicationId;
        console.log(`--- BACKEND DEBUG: GET /api/chat/:applicationId received for application ID: ${applicationId}`);

        const chat = await Chat.findOne({ application: applicationId })
                               .populate('messages.sender', 'username');

        if (!chat) {
            console.log(`--- BACKEND DEBUG: No chat found for application ID: ${applicationId}. Returning empty chat.`);
            return res.json({ _id: null, application: applicationId, participants: [], messages: [] });
        }

        const formattedMessages = chat.messages.map(msg => ({
            _id: msg._id,
            sender: msg.sender._id,
            senderUsername: msg.sender.username,
            content: msg.content || '',
            timestamp: msg.timestamp,
            attachment: msg.attachment,
            attachmentType: msg.attachmentType
        }));
        console.log(`--- BACKEND DEBUG: Chat history found for application ID ${applicationId}. Messages count: ${formattedMessages.length}`);

        res.json({
            _id: chat._id,
            application: chat.application,
            participants: chat.participants,
            messages: formattedMessages
        });
    } catch (err) {
        console.error("--- BACKEND ERROR: Error fetching chat history:", err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// PUT /api/chat/:chatId/read - Mark messages as read
router.put('/:chatId/read', auth, async (req, res) => {
    try {
        const chatId = req.params.chatId;
        console.log(`--- BACKEND DEBUG: PUT /api/chat/:chatId/read received for chat ID: ${chatId}`);
        const chat = await Chat.findById(chatId);
        if (!chat) {
            console.log(`--- BACKEND DEBUG: Chat not found for read request: ${chatId}`);
            return res.status(404).json({ msg: 'Chat not found' });
        }

        console.log(`--- BACKEND DEBUG: Chat ${chatId} marked as read by user ${req.user.id}`);
        res.json({ msg: 'Chat marked as read' });
    } catch (err) {
        console.error("--- BACKEND ERROR: Error marking chat as read:", err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
});

module.exports = router;
