import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const teamSchema = new Schema({
  name: String,
  company_id: { type: Schema.Types.ObjectId, ref: 'Company' },
  users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  created_at: { type: Date, default: Date.now }
});

export default model('Team', teamSchema);
