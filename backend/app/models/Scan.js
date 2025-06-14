import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const scanSchema = new Schema({
  project_id: { type: Schema.Types.ObjectId, ref: 'Project' },
  launched_by: { type: Schema.Types.ObjectId, ref: 'User' },
  target: String, 
  status: { type: String, enum: ['waiting', 'running', 'completed', 'error'], default: 'waiting' },
  type : { type: String, enum: ['user', 'quick', 'reason', 'no_user'], default: 'quick' },
  started_at: Date,
  finished_at: Date,
  commands_executed: [
    {
      command: String,
    }
  ],
  report_url: String,
  iterations: { type: Number, default: 3 },
  created_at: { type: Date, default: Date.now }
});

export default model('Scan', scanSchema);
