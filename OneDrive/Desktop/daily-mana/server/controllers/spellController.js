const axios = require('axios');
const Spell = require('../models/Spell');

// Base URL for the D&D API (from our .env file)
const DND_API_URL = process.env.DND_API_BASE_URL || 'https://www.dnd5eapi.co/api';
const SPELL_COOLDOWN_DAYS = 30; // Don't show same spell within 30 days

/**
 * Helper function: Get a normalized list of all spells
 * Returns an array of { index, name } objects
 */
async function getNormalizedSpellList() {
  try {
    // First, try to get from database ignoring the id placed on it by mongodb
    const dbSpells = await Spell.find({}).select('index name -_id').lean();
    
    if (dbSpells.length > 0) {
      console.log(`Using ${dbSpells.length} spells from database`);
      return dbSpells;
    }

    // If no spells in DB, fetch from API
    console.log('Fetching spell list from D&D API...');
    const response = await axios.get(`${DND_API_URL}/spells`);
    
    if (!response.data || !response.data.results) {
      throw new Error('Invalid response from D&D API');
    }
    
    // Normalize the API response
    const normalizedSpells = response.data.results.map(spell => ({
      index: spell.index,
      name: spell.name
    }));
    
    // Save spells to database for future use
    // Create minimal spell entries first
        await Promise.all(
          normalizedSpells.map(spell =>
          Spell.findOneAndUpdate(
          { index: spell.index },
          { 
            index: spell.index,
            name: spell.name,
            desc: 'No description available',
            level: 0,
            school: { name: 'Unknown', index: 'unknown' }
          },
          { upsert: true, new: true }
         ) .catch(err => 
        console.error(`Error saving spell ${spell.index} to DB:`, err.message)
         )
        )
    );
    
    console.log(`Saved ${normalizedSpells.length} spells to database`);
    return normalizedSpells;

  } catch (error) {
    console.error('Error in getNormalizedSpellList:', error.message);
    throw new Error('Failed to fetch spell list from D&D API');
  }
}

//Return only spells that are elegeble to be shown 
async function getAvailableSpells(cooldownDays) {
  try {
    // Calculate the cutoff date as a YYYY-MM-DD string.Spells shown after this date are still on cooldown.
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cooldownDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // return available spells from database
    const available = await Spell.find({
      $or: [
        { lastShownDate: null }, // Never shown before
        { lastShownDate: { $lt: cutoffDateStr } } // Shown before cutoff date 
      ]
    }).select("index name").lean();

    //Edge case - all spells have been shown recently - reset and start over
    if(available.length === 0){
      console.log('All spells have been shown recently. Resetting cooldown and starting fresh cycle...');
      return Spell.find({}).select("index name").lean();
    }
console.log(`${available.length} spells are available after cooldown filter`);
return available;
  } catch (error) {
    console.error('Error in getAvailableSpells:', error.message);
    return Spell.find({}).select('index name').lean();
  }
}
// Return a spalls info 
  async function getSpellNameAndDescription(index){
    try{
      //Check database first
      const spell = await Spell.findOne({index}).lean();
      // We check it's not the placeholder string from getNormalizedSpellList().
      if(spell && spell.desc && spell.desc !== 'No description available'){ 
        console.log(`Return spell "${index}" from database`);
        return {
          index: spell.index,
          name: spell.name,
          desc: spell.desc,
          liked: spell.liked || false
        };  
      }

// Not in the database or in the place holder - fething info from the API
    console.log(`Fetching details for ${index} from API...`);
    const response = await axios.get(`${DND_API_URL}/spells/${index}`);
    const spellData = response.data;
    
    // Validate the response
    if (!spellData || !spellData.index) {
      throw new Error('Received malformed spell data from D&D API');
    }
    
    // Save full spell data to database with proper field validation
    const savedSpell = await Spell.findOneAndUpdate(
      { index: spellData.index },
      {
        index: spellData.index,
        name: spellData.name || 'Unknown Spell',
        desc: (spellData.desc || []).join('\n\n') || 'No description available.',
        higher_level: spellData.higher_level || [],
        level: spellData.level !== undefined ? spellData.level : 0,
        school: spellData.school || { name: 'Unknown', index: 'unknown' },
        ritual: spellData.ritual || false,
        casting_time: spellData.casting_time || 'Unknown',
        range: spellData.range || 'Unknown',
        components: spellData.components || [],
        material: spellData.material || '',
        duration: spellData.duration || 'Unknown',
        concentration: spellData.concentration || false,
        classes: spellData.classes || [],
        subclasses: spellData.subclasses || []
      },
      { upsert: true, new: true }
    );
    
    console.log(`Saved/Updated spell ${index} in database`);
    
    // Return only name and description
    return {
      index: savedSpell.index,
      name: savedSpell.name,
      desc: savedSpell.desc, 
      liked:savedSpell.liked || false
    };
  } catch (error) {
    console.error(`Error fetching spell ${index}:`, error.message);
    
    // If API fetch fails, try to return whatever we have in DB
    try {
      const fallback = await Spell.findOne({ index }).lean();
      if (fallback) {
        console.log(`Using fallback data for spell ${index} from database`);
        return {
          index: fallback.index,
          name: fallback.name,
          desc: fallback.desc || 'Description temporarily unavailable.',
          liked:fallback.liked || false
        };
      }
    } catch (fallbackError) {
      console.error(`Fallback also failed for spell ${index}:`, fallbackError.message);
    }
    
    throw new Error(`Failed to fetch spell details for ${index}`);
  }
}
    
//  Returns today's spell of the day. If a spell has already been , chosen today, returns the same one. Otherwise picks a new one. 
exports.getDailySpell = async (req, res) => {
  try {
     // We only want the date part (index [0]).
    const today = new Date().toISOString().split('T')[0];
    console.log(`getDailySpell called — looking for spell for date: ${today}`);
 // We look for any Spell document whose lastShownDate matches today's date.
    const todaySpell = await Spell.findOne({ lastShownDate: today });
  if (todaySpell) {
  // No try/catch needed here: res.json() doesn't throw.
      console.log(`Found today's spell: "${todaySpell.name}" — returning from cache`);
      return res.json({
        success: true,
        spell:   todaySpell,
        message: "Today's spell (already chosen)"
      });
    }
 console.log('No spell chosen yet today — picking a new one...');
    const allSpells = await getNormalizedSpellList();
 
    if (!allSpells || allSpells.length === 0) {
      throw new Error('No spells found in database or API');
    }

     const availableSpells = await getAvailableSpells(SPELL_COOLDOWN_DAYS);
    console.log(`Choosing from ${availableSpells.length} available spells`);
 
 // Multiplying by the array length and flooring gives a random valid index.
    const randomIdx      = Math.floor(Math.random() * availableSpells.length);
    const chosenSpellRef = availableSpells[randomIdx];
    console.log(`Chosen spell: "${chosenSpellRef.name}" (${chosenSpellRef.index})`);
 
  // This either returns from the DB cache or fetches from the D&D API.
    const spellData = await getSpellNameAndDescription(chosenSpellRef.index);
 
    // Now the date tracking lives on the Spell document itself — no separate collection needed.
    await Spell.findOneAndUpdate(
      { index: chosenSpellRef.index },  // Find this specific spell
      { lastShownDate: today }          // Set today's date on it
    );
    console.log(`Recorded lastShownDate = "${today}" on spell "${chosenSpellRef.index}"`);
  
     res.json({
      success: true,
      spell:   spellData,
      message: "Today's fresh spell!"
    });
 
  } catch (error) {
    console.error('Error in getDailySpell:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily spell',
      // Only expose the real error message in development — hide it in production
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};
    
//likespell PUT request to update the spell as liked in the database and return the updated spell info to the front end to update the UI.
exports.likeSpell = async (req, res) => {
  try{
    //pull the spell index from the url
    const  {index} = req.params;
    //finds the spell in the indexe and updates if liked 
    const updatedSpell = await Spell.findOneAndUpdate(
      {index},
      {liked:true},
      {new: true}
    );
    //if no spell found send 404
    if(!updatedSpell){
      return res.status(404).json({
        success:false,
        message: "spell not found"
      });
    }
    //send updated spell back to the front end to upate 
    res.json({
      success: true,
      message: `${updatedSpell.name} has been liked`,
      spell:{
        index: updatedSpell.index,
        name: updatedSpell.name,
        liked: updatedSpell.liked
      }
    });
  }catch(error){
    console.error('Error in likeSpell:', error);
    res.status(500).json({
      success:false,
      message: 'Failed to like spell',
      error: process.env.NODE_ENV === 'production' ? "internal server error" : error.message
    });
  }
};

// unlikeSpell — DELETE /api/spells/:index/like
exports.unlikeSpell = async (req, res) => {
  try{
    const {index} = req.params;
    const updatedSpell = await Spell.findOneAndUpdate(
      {index},
      {liked: false},
      {new: true}
    );
    if(!updatedSpell){
      return res.status(404).json({
        success: false,
        message: 'Spell not found'
      });
    }
    res.json({
      success: true,
      message: `${updatedSpell.name} has been unliked`,
      spell:{
        index:updatedSpell.index,
        name: updatedSpell.name,
        liked: updatedSpell.liked
      }
    });
  }catch (error){
    console.error('Error in unlikedSpell:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlike spell',
      error: process.env.NODE_ENV === 'production' ? 'internal server error' : error.message
    });
  }
};

//delete functionality for spell

exports.deleteSpell = async (req, res) =>{
  try{
    const {index} = req.params
    //returns thee deleted spell to use in the responce
    const deletedSpell = await Spell.findOneAndDelete({index});

    if(!deletedSpell){
      return res.status(404).json({
        success: false,
        message: 'Spell not found'
      });
    }
    res.json({
      success:true,
      message: `${deletedSpell.name} has been deleted`
    });
  }catch (error){
    console.error('Error in deletedSpell', error);
      res.status(500).json({
        success:false,
        message: 'Failed to delete spell',
        error: process.env.NODE_ENV === 'production'? "Internal server error" : error.message
      });
  }
};
