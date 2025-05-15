import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const userSchema = new Schema({
  username: String,
  email: String,
  password: String,
  // company: { type: Schema.Types.ObjectId, ref: 'Company' },
  // teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  created_at: { type: Date, default: Date.now },
  is_admin: { type: Boolean, default: false },
});

export default model('User', userSchema);
