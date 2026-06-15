const express = require('express');
const router = express.Router();
const spellController = require('../controllers/spellController');

// GET /api/daily-spell - Get today's spell
router.get('/daily-spell', spellController.getDailySpell);

// PUT /api/spells/:index/like - marks a spell as liked 
router.put('/spells/:index/like', spellController.likeSpell);

//Delete /api/spells/:index/like -remove like from the spell
router.delete('/spells/:index/like',spellController.unlikeSpell);

// DELETE /api/spells/:index - delete a spell from the database
router.delete('/spells/:index', spellController.deleteSpell);

module.exports = router;