// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      minlength: 5,
      maxlength: 254
    },
    password: { type: String, required: true, select: false },
  },
  { versionKey: false, timestamps: true }
);

// REMOVE this if you keep unique on the path
// userSchema.index({ username: 1 }, { unique: true });

export default mongoose.model('User', userSchema);
