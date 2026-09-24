const mongoose = require('mongoose');

const DistressBeaconSchema = new mongoose.Schema({
  citizenName: {
    type: String,
    required: true,
    trim: true,
    default: 'Anonymous Citizen',
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  needType: {
    type: String,
    enum: ['Rescue', 'Medical', 'Food', 'Shelter'],
    required: true,
  },
  urgency: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'High',
  },
  peopleCount: {
    type: Number,
    default: 1,
    min: 1,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: {
      type: String,
      default: '',
    },
  },
  status: {
    type: String,
    enum: ['Pending', 'Claimed', 'In-Progress', 'Resolved'],
    default: 'Pending',
  },
  claimedBy: {
    type: String,
    default: null,
  },
  lockedAt: {
    type: Date,
    default: null,
  },
  isDuplicate: {
    type: Boolean,
    default: false,
  },
  clusterParentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DistressBeacon',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

DistressBeaconSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('DistressBeacon', DistressBeaconSchema);