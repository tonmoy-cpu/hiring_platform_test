const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    // Removed 'required: true' to make content optional
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  attachment: { // For file attachments
    type: String,
  },
  attachmentType: { // e.g., 'application/pdf', 'image/jpeg'
    type: String,
  },
}, { _id: true }); // Ensure _id is true for subdocuments

const ChatSchema = new mongoose.Schema({
  application: { // Link to the specific application
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
    unique: true, // One chat per application
  },
  participants: [{ // Users involved in the chat
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  messages: [MessageSchema], // Array of message subdocuments
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Chat', ChatSchema);
