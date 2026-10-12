const app = require("express")();
app.get('/v1/invoices', list);
app.post('/v1/invoices/:id/pay', pay);
producer.send({ topic: 'invoice.paid', messages: [] });
module.exports = app;
