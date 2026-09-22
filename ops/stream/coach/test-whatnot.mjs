import assert from 'node:assert/strict';
import {publicProfile} from './whatnot-observer.mjs';
assert.deepEqual(publicProfile('treasure_hauls\nJared Tolley\n•\n97 Sold\n11 Following\n•\n68 Followers',100),{handle:'treasure_hauls',followers:68,sold:97,observedAt:100,source:'Whatnot public profile'});
assert.equal(publicProfile('someone_else\n97 Sold\n68 Followers'),null);
assert.equal(publicProfile('treasure_hauls\n97K Sold\n6.8K Followers'),null,'Rounded display values are not exact counts');
assert.equal(publicProfile('Log in\nWelcome back to Whatnot'),null);
console.log('Whatnot profile identity, exact counts, rounded values and login boundary passed');
