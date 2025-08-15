// Load all functions
require('./health');
require('./userManagement');
require('./generateNotes');
require('./speechToken');
require('./usersSimple');  // ADD THIS for backward compatibility
require('./patients');      // ADD THIS
require('./visits');        // ADD THIS

console.log('Functions loaded: health, userManagement, generateNotes, speechToken, usersSimple, patients, visits');
