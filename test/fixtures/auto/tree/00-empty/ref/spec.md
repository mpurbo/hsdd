# Shop: product specification

Version: v1. Status: accepted RFC.

## 1. Purpose

A small online shop. Customers browse products, put them in a cart and place
orders. Staff read orders to fulfil them. Payment is taken by an external
provider and is out of scope here.

## 2. Order API

The backend exposes an order API over HTTP with JSON bodies:

- create an order from a customer id and a list of lines (sku, quantity);
- read one order by its id;
- list one customer's orders, newest first.

An order carries its id, the customer id, its lines, the total in cents and a
status (`placed`, `paid`, `cancelled`). Order ids are opaque strings that start
with `ord_`; clients never parse them. A missing order is a 404 with an error
envelope `{ code, message }`.

## 3. Web app

The web app is everything a customer sees in a browser. It starts as one
storefront app: product list, cart, checkout and order history. Checkout calls
the order API to create the order; order history lists the customer's orders.
The web app never stores orders itself.

## 4. Constraints

- One team builds both the order API and the web app.
- The web app is built and tested against recorded examples of the order API,
  not against a running backend.
- Totals are integers in cents; no floating point anywhere.
