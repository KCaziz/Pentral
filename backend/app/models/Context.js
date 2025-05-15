import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const contextSchema = new Schema({
  name: String,
  description: String,
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now }
});

export default model('Context', contextSchema);
