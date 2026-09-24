const express = require('express');
const router = express.Router();
const DistressBeacon = require('../models/DistressBeacon');

// Module 1 & 4: Distress Beacon Submission with Proximity Deduplication
router.post('/beacon', async (req, res) => {
  try {
    const { citizenName, phone, needType, urgency, peopleCount, latitude, longitude, address } = req.body;
    const lon = parseFloat(longitude);
    const lat = parseFloat(latitude);

    // Proximity Deduplication: Check for open beacons within a 150m radius of identical needType
    const duplicateCluster = await DistressBeacon.findOne({
      needType,
      status: { $ne: 'Resolved' },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lon, lat] },
          $maxDistance: 150, // 150 meters threshold
        },
      },
    });

    const isDuplicate = Boolean(duplicateCluster);
    const clusterParentId = duplicateCluster ? duplicateCluster._id : null;

    const beacon = new DistressBeacon({
      citizenName,
      phone,
      needType,
      urgency,
      peopleCount,
      location: {
        type: 'Point',
        coordinates: [lon, lat],
        address: address || '',
      },
      isDuplicate,
      clusterParentId,
    });

    const savedBeacon = await beacon.save();

    // Broadcast live event over WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('beacon_broadcast', savedBeacon);
    }

    res.status(201).json({
      success: true,
      message: isDuplicate ? 'Distress Beacon received (flagged as nearby redundant appeal).' : 'Distress Beacon verified & dispatched to control rooms.',
      beacon: savedBeacon,
    });
  } catch (error) {
    console.error('Error logging beacon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Module 3: Live GIS Command View (Fetch all active incident records)
router.get('/feed', async (req, res) => {
  try {
    const beacons = await DistressBeacon.find().sort({ createdAt: -1 });
    res.json(beacons);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Module 2: Atomic Task-Locking Protocol (Prevents concurrent NGO race conditions)
router.patch('/lock/:id', async (req, res) => {
  try {
    const { volunteerName } = req.body;

    const lockedBeacon = await DistressBeacon.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending' },
      {
        $set: {
          status: 'Claimed',
          claimedBy: volunteerName || 'Verified Field Volunteer',
          lockedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!lockedBeacon) {
      return res.status(409).json({
        success: false,
        message: 'Task Conflict: This distress beacon has already been claimed by another field unit.',
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('beacon_locked', lockedBeacon);
    }

    res.json({ success: true, beacon: lockedBeacon });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Module 3: Update Beacon Status (In-Progress / Resolved)
router.patch('/status/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await DistressBeacon.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('beacon_status_change', updated);
    }

    res.json({ success: true, beacon: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Module 4: Relief Gap & Operational Analytics Endpoint
router.get('/analytics/gaps', async (req, res) => {
  try {
    const pendingTotal = await DistressBeacon.countDocuments({ status: 'Pending' });
    const claimedTotal = await DistressBeacon.countDocuments({ status: { $in: ['Claimed', 'In-Progress'] } });
    const resolvedTotal = await DistressBeacon.countDocuments({ status: 'Resolved' });
    const duplicatesTotal = await DistressBeacon.countDocuments({ isDuplicate: true });

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const criticalBlindSpots = await DistressBeacon.find({
      status: 'Pending',
      createdAt: { $lt: thirtyMinutesAgo },
    });

    res.json({
      metrics: { pendingTotal, claimedTotal, resolvedTotal, duplicatesTotal },
      blindSpots: criticalBlindSpots,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;