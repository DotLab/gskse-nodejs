var debug = require('debug')('gskse:test:friendController');
var gskse = require('../config');

var should = require('should');
var sharp = require('sharp');

var friendController = gskse.getController('friendController');

var Friend = gskse.getModel('friend');

describe('friendController', function() {
	before('clear database', function(done) {
		Promise.all([
			Friend.remove({}),
		]).then(() => done()).catch(err => done(err));
	});

	describe('::signup', function() {
		it('can signup', function(done) {
			sharp({ create: {
				width: 64,
				height: 64,
				channels: 4,
				background: { r: 255, g: 0, b: 0, alpha: 128 },
			} }).jpeg().toBuffer().then(data => {
				return friendController.signup('Kailang', '123', data);
			}).then(friend => {
				should.exist(friend);
				friend.name.should.be.exactly('Kailang');
				friend.cash.should.be.exactly(gskse.startFund);
				done();
			}).catch(err => done(err));
		});
	});

	describe('::login', function() {
		it('can login', function(done) {
			friendController.login('Kailang', '123').then(friend => {
				should.exist(friend);
				done();
			}).catch(err => done(err));
		});
	});

	describe('::pay', function() {
		it('can pay', function(done) {
			Friend.findOne({}).then(friend => {
				should.exist(friend);
				return friendController.pay(friend, 100);
			}).then(friend => {
				should.exist(friend);
				friend.cash.should.be.within(0, gskse.startFund);
				done();
			}).catch(err => done(err));
		});
		it('cannot pay more than it has', function(done) {
			Friend.findOne({}).then(friend => {
				should.exist(friend);
				return friendController.pay(friend, 1e20);
			}).then(friend => {
				should.exist(friend);
				done(friend.cash);
			}).catch(err => {
				err.name.should.be.exactly(gskse.status.too_poor().name);
				done();
			});
		});
	});
});