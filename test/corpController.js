var debug = require('debug')('gskse:test:corpController');
var gskse = require('../config');

var should = require('should');
var sharp = require('sharp');

var friendController = gskse.getController('friendController');
var corpController = gskse.getController('corpController');

var Friend = gskse.getModel('friend');
var Corp = gskse.getModel('corp');
var Order = gskse.getModel('order');
var Tick = gskse.getModel('tick');
var Stock = gskse.getModel('stock');

describe('corpController', function() {
	var self = this;

	before('clear database', function(done) {
		Promise.all([
			Friend.remove({}),
			Corp.remove({}),
			Order.remove({}),
			Tick.remove({}),
			Stock.remove({}),
		]).then(() => done()).catch(err => done(err));
	});

	describe('::register', function() {
		it('can register', function(done) {
			sharp({ create: {
				width: 64,
				height: 64,
				channels: 4,
				background: { r: 255, g: 0, b: 0, alpha: 128 },
			} }).jpeg().toBuffer().then(data => {
				self.avatarData = data;
				return friendController.signup('Kailang', '123', data);
			}).then(friend => {
				should.exist(friend);
				self.friend = friend;
				return friendController.signup('Kailang_1', '123', self.avatarData);
			}).then(friend => {
				should.exist(friend);
				self.friend1 = friend;
				return corpController.register(self.friend, 'C.C.', 'Description', 'CC', 'en', self.avatarData);
			}).then(corp => {
				self.corp = corp;
				should.exist(corp);
				corp.name.should.be.exactly('C.C.');
				corp.desc.should.be.exactly('Description');
				corp.symbol.should.be.exactly('CC');
				corp.locale.should.be.exactly('en');
				should.exist(corp.ceo);
				should.exist(corp.life);
				should.exist(corp.founder);
				done();
			}).catch(err => done(err));
		});
	});

	describe('::findCorp', function() {
		it('can find corp', function(done) {
			corpController.findCorp('CC', 'en').then(corp => {
				should.exist(corp);
				done();
			}).catch(err => done(err));
		});
	});

	describe('::findStockOrCreateOne', function() {
		it('can create stock', function(done) {
			corpController.findStockOrCreateOne(self.friend, self.corp).then(stock => {
				should.exist(stock);
				done();
			}).catch(err => done(err));
		});
	});

	describe('::createTick', function() {
		it('can create tick', function(done) {
			corpController.createTick(self.corp, self.friend, self.friend, 100, 10).then(tick => {
				should.exist(tick);
				done();
			}).catch(err => done(err));
		});
	});

	describe('::invest', function() {
		it('can invest', function(done) {
			corpController.invest(self.friend, self.corp, 1000).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(1000);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});
		it('cannot invest more than it has', function(done) {
			corpController.invest(self.friend, self.corp, 2000000).then(order => {
				done(order);
			}).catch(err => {
				err.name.should.be.exactly(gskse.status.too_poor().name);
				done();
			});
		});
		it('cannot invest after first offer', function(done) {
			corpController.offer(self.friend, self.corp, 100, 10).then(stock => {
				return corpController.invest(self.friend, self.corp, 100);
			}).then(order => {
				done(order);
			}).catch(err => {
				err.name.should.be.exactly(gskse.status.bad_request().name);
				done();
			});
		});
	});

	describe('::offer', function() {
		it('allow ceo to offer', function(done) {
			corpController.offer(self.friend, self.corp, 100, 10).then(stock => {
				should.exist(stock);
				done();
			}).catch(err => done(err));
		});
		it('forbid others from offering', function(done) {
			corpController.offer(self.friend1, self.corp, 100, 10).then(stock => {
				done(stock);
			}).catch(err => {
				err.name.should.be.exactly(gskse.status.unauthorized().name);
				done();
			});
		});
	});

	describe('::findOrders', function() {
		beforeEach('clear orders', function(done) {
			Order.remove({}).then(() => done());
		});

		it('different limit orders', function(done) {
			Promise.all([
				corpController.trade(self.friend, self.corp, 25, 19, 'sell', 'limit', 'day'),
				corpController.trade(self.friend, self.corp, 50, 18, 'sell', 'limit', 'gtc'),
				corpController.trade(self.friend, self.corp, 70, 17, 'sell', 'limit', '1m'),
				corpController.trade(self.friend, self.corp, 60, 16, 'sell', 'limit', '3m'),
				corpController.trade(self.friend, self.corp, 80, 15, 'sell', 'limit', '5m'),

				corpController.trade(self.friend1, self.corp, 2, 9, 'buy', 'limit', 'day'),
				corpController.trade(self.friend1, self.corp, 5, 8, 'buy', 'limit', 'gtc'),
				corpController.trade(self.friend1, self.corp, 7, 7, 'buy', 'limit', '1m'),
				corpController.trade(self.friend1, self.corp, 6, 6, 'buy', 'limit', '3m'),
				corpController.trade(self.friend1, self.corp, 8, 5, 'buy', 'limit', '5m'),
			]).then(results => {
				return corpController.findOrders(self.corp);
			}).then(orders => {
				orders.asks.should.have.length(5);
				orders.asks.map(a => a.quantity).should.deepEqual([ 25, 50, 70, 60, 80 ]);
				orders.asks.map(a => a.price).should.deepEqual([ 19, 18, 17, 16, 15 ]);

				orders.bids.should.have.length(5);
				orders.bids.map(a => a.quantity).should.deepEqual([ 2, 5, 7, 6, 8 ]);
				orders.bids.map(a => a.price).should.deepEqual([ 9, 8, 7, 6, 5 ]);
				done();
			}).catch(err => done(err));
		});

		it('same limit different time orders', function(done) {  // chain thens together to ensure the different placed time
			corpController.trade(self.friend, self.corp, 10, 10, 'sell', 'limit', 'day').then(ignored => {
				return corpController.trade(self.friend, self.corp, 10, 10, 'sell', 'limit', 'gtc');
			}).then(ignored => {
				return corpController.trade(self.friend1, self.corp, 10, 9, 'buy', 'limit', '3m');
			}).then(ignored => {
				return corpController.trade(self.friend1, self.corp, 10, 9, 'buy', 'limit', '5m');
			}).then(results => {
				return corpController.findOrders(self.corp);
			}).then(orders => {
				orders.asks.should.have.length(2);
				orders.asks.map(a => a.duration).should.deepEqual([ 'gtc', 'day' ]);

				orders.bids.should.have.length(2);
				orders.bids.map(a => a.duration).should.deepEqual([ '3m', '5m' ]);
				done();
			}).catch(err => done(err));
		});

		it('same sell market different time orders', function(done) {  // chain thens together to ensure the different placed time
			corpController.trade(self.friend, self.corp, 10, 0, 'sell', 'market', 'day').then(ignored => {
				return corpController.trade(self.friend, self.corp, 10, 0, 'sell', 'market', 'gtc');
			}).then(ignored => {
				return corpController.trade(self.friend1, self.corp, 10, 0, 'sell', 'market', '3m');
			}).then(ignored => {
				return corpController.trade(self.friend1, self.corp, 10, 0, 'sell', 'market', '5m');
			}).then(results => {
				return corpController.findOrders(self.corp);
			}).then(orders => {
				orders.asks.should.have.length(4);
				orders.asks.map(a => a.duration).should.deepEqual([ '5m', '3m', 'gtc', 'day' ]);
				done();
			}).catch(err => done(err));
		});

		it('same buy market different time orders', function(done) {  // chain thens together to ensure the different placed time
			corpController.trade(self.friend, self.corp, 10, 0, 'buy', 'market', 'day').then(ignored => {
				return corpController.trade(self.friend, self.corp, 10, 0, 'buy', 'market', 'gtc');
			}).then(ignored => {
				return corpController.trade(self.friend1, self.corp, 10, 0, 'buy', 'market', '3m');
			}).then(ignored => {
				return corpController.trade(self.friend1, self.corp, 10, 0, 'buy', 'market', '5m');
			}).then(results => {
				return corpController.findOrders(self.corp);
			}).then(orders => {
				orders.bids.should.have.length(4);
				orders.bids.map(a => a.duration).should.deepEqual([ 'day', 'gtc', '3m', '5m' ]);
				done();
			}).catch(err => done(err));
		});

		it('limit market sell orders', function(done) {
			Promise.all([
				corpController.trade(self.friend, self.corp, 25, 20, 'sell', 'limit', 'day'),
				corpController.trade(self.friend, self.corp, 30, 10, 'sell', 'limit', 'gtc'),
				corpController.trade(self.friend, self.corp, 40, 0, 'sell', 'market', '1m'),
			]).then(results => {
				return corpController.findOrders(self.corp);
			}).then(orders => {
				orders.asks.should.have.length(3);
				orders.asks.map(a => a.quantity).should.deepEqual([ 25, 30, 40 ]);
				orders.asks.map(a => a.duration).should.deepEqual([ 'day', 'gtc', '1m' ]);
				done();
			}).catch(err => done(err));
		});

		it('limit market buy orders', function(done) {
			Promise.all([
				corpController.trade(self.friend, self.corp, 40, 0, 'buy', 'market', '1m'),
				corpController.trade(self.friend, self.corp, 25, 20, 'buy', 'limit', 'day'),
				corpController.trade(self.friend, self.corp, 30, 10, 'buy', 'limit', 'gtc'),
			]).then(results => {
				return corpController.findOrders(self.corp);
			}).then(orders => {
				orders.bids.should.have.length(3);
				orders.bids.map(a => a.quantity).should.deepEqual([ 40, 25, 30 ]);
				orders.bids.map(a => a.duration).should.deepEqual([ '1m', 'day', 'gtc' ]);
				done();
			}).catch(err => done(err));
		});
	});

	describe('::trade', function() {
		beforeEach('clear orders', function(done) {
			Order.remove({}).then(() => done());
		});

		it('buy sell at limit, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 2, 'sell', 'limit', '1m');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('buy sell x2 at limit, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 50, 2, 'sell', 'limit', '3m');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 50, 2, 'sell', 'limit', '5m');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(100);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('buy sell at different limit, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 3, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 2, 'sell', 'limit', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(250);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('buy sell at mismatch limit, no trade, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 1, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 2, 'sell', 'limit', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(100);
				order.deal.should.be.exactly(0);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('buy sell ioc at limit, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 2, 'sell', 'limit', 'ioc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('buy sell ioc at limit, not filled, aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 200, 2, 'sell', 'limit', 'ioc');
			}).then(order => {
				order.unfilled.should.be.exactly(100);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.true();
				done();
			}).catch(err => done(err));
		});

		it('buy at limit sell at market, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 0, 'sell', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('buy at limit sell at market, not filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 200, 0, 'sell', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(100);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('buy sell at market, filled, not aborted', function(done) {
			corpController.createTick(self.corp, self.friend, self.friend1, 1, 2).then(tick => {
				return corpController.trade(self.friend1, self.corp, 50, 0, 'buy', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(50);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend1, self.corp, 50, 0, 'buy', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(50);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 75, 0, 'sell', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(150);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 25, 0, 'sell', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(50);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 1, 0, 'sell', 'market', 'ioc');
			}).then(order => {
				order.unfilled.should.be.exactly(1);
				order.deal.should.be.exactly(0);
				order.is_aborted.should.be.true();
				done();
			}).catch(err => done(err));
		});

		it('buy at limit sell at market, not filled, buyer too poor', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2000000, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 0, 'sell', 'market', '1m');
			}).then(order => {
				order.unfilled.should.be.exactly(100);
				order.deal.should.be.exactly(0);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('buy at limit sell at market, not filled, seller too poor', function(done) {
			corpController.trade(self.friend1, self.corp, 2000, 2, 'buy', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(2000);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 2000, 0, 'sell', 'market', '1m');
			}).then(order => {
				order.unfilled.should.be.exactly(2000);
				order.deal.should.be.exactly(0);
				order.is_aborted.should.be.true();
				done();
			}).catch(err => done(err));
		});

		// flipped -----------------------------------------------------------------------------------------

		it('sell buy at limit, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 2, 'buy', 'limit', '1m');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('sell buy x2 at limit, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 50, 2, 'buy', 'limit', '3m');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 50, 2, 'buy', 'limit', '5m');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(100);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('sell buy at different limit, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 3, 'buy', 'limit', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(250);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('sell buy at mismatch limit, no trade, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 3, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 2, 'buy', 'limit', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(100);
				order.deal.should.be.exactly(0);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('sell buy ioc at limit, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 2, 'buy', 'limit', 'ioc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('sell buy ioc at limit, not filled, aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 200, 2, 'buy', 'limit', 'ioc');
			}).then(order => {
				order.unfilled.should.be.exactly(100);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.true();
				done();
			}).catch(err => done(err));
		});

		it('sell at limit buy at market, filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 0, 'buy', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('sell at limit buy at market, not filled, not aborted', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 200, 0, 'buy', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(100);
				order.deal.should.be.exactly(200);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});

		it('sell buy at market, filled, not aborted', function(done) {
			corpController.createTick(self.corp, self.friend, self.friend1, 1, 2).then(tick => {
				return corpController.trade(self.friend1, self.corp, 50, 0, 'sell', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(50);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend1, self.corp, 50, 0, 'sell', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(50);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 75, 0, 'buy', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(150);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 25, 0, 'buy', 'market', 'gtc');
			}).then(order => {
				order.unfilled.should.be.exactly(0);
				order.deal.should.be.exactly(50);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 1, 0, 'buy', 'market', 'ioc');
			}).then(order => {
				order.unfilled.should.be.exactly(1);
				order.deal.should.be.exactly(0);
				order.is_aborted.should.be.true();
				done();
			}).catch(err => done(err));
		});

		it('sell at limit buy at market, not filled, buyer too poor', function(done) {
			corpController.trade(self.friend1, self.corp, 100, 2000000, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(100);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 100, 0, 'buy', 'market', '1m');
			}).then(order => {
				order.unfilled.should.be.exactly(100);
				order.deal.should.be.exactly(0);
				order.is_aborted.should.be.true();
				done();
			}).catch(err => done(err));
		});

		it('sell at limit buy at market, not filled, seller too poor', function(done) {
			corpController.trade(self.friend1, self.corp, 2000, 2, 'sell', 'limit', 'gtc').then(order => {
				order.unfilled.should.be.exactly(2000);
				order.is_aborted.should.be.false();
				return corpController.trade(self.friend, self.corp, 2000, 0, 'buy', 'market', '1m');
			}).then(order => {
				order.unfilled.should.be.exactly(2000);
				order.deal.should.be.exactly(0);
				order.is_aborted.should.be.false();
				done();
			}).catch(err => done(err));
		});
	});
});