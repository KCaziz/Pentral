import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const statsSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User' },
  total_projects: Number,
  total_scans: Number,
  total_time_spent_seconds: Number,
  estimated_time_saved_seconds: Number,
  average_scan_duration_seconds: Number,
  updated_at: { type: Date, default: Date.now }
});

export default model('Stats', statsSchema);
