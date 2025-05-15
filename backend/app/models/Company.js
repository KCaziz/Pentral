import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const companySchema = new Schema({
  name: String,
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  created_at: { type: Date, default: Date.now }
});

export default model('Company', companySchema);
