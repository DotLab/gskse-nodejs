var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var helper = require('./helper');

var FriendSchema = new Schema({
	avatar: 	helper.string(),
	name: 		helper.stringUniqueMatch(/^[_a-zA-Z][_a-zA-Z0-9]{0,30}$/),

	salt: 		helper.string(),
	hash: 		helper.string(),

	cash: 		helper.number(),
	value: 		helper.number(),  //= cash + <value of stocks owned>

	joined: 	helper.date(),
});

module.exports = mongoose.model('Friend', FriendSchema);