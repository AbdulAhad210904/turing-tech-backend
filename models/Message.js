import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

messageSchema.index({ chat: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);

