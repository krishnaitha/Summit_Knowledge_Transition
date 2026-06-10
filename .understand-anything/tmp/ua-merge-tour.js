#!/usr/bin/env node
const fs = require('fs');

const graphPath = process.argv[2];
const tourPath = process.argv[3];

const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const tour = JSON.parse(fs.readFileSync(tourPath, 'utf8'));

graph.tour = tour;

fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
console.log('Tour merged. Steps:', tour.length);
console.log('Graph keys:', Object.keys(graph).join(', '));
