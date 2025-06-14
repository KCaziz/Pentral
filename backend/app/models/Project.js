import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const projectSchema = new Schema({
  name: String,
  description: String,
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  company: { type: String, default: "personnel" },
  scans: [{ type: Schema.Types.ObjectId, ref: 'Scan' }],
  shared_with_users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  created_at: { type: Date, default: Date.now }
});

export default model('Project', projectSchema);
