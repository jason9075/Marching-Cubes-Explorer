const fs = require('fs');
const https = require('https');

https.get('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/objects/MarchingCubes.js', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        // Extract exactly the array contents
        const edgeStart = data.indexOf('const edgeTable = new Int32Array(') + 'const edgeTable = new Int32Array('.length;
        const edgeEnd = data.indexOf('] );', edgeStart) + 1;
        const edgeStr = data.substring(edgeStart, edgeEnd);

        const triStart = data.indexOf('const triTable = new Int32Array(') + 'const triTable = new Int32Array('.length;
        const triEnd = data.indexOf('] );', triStart) + 1;
        const triStr = data.substring(triStart, triEnd);

        const out = `
export const EDGE_TABLE = ${edgeStr};

export const TRI_TABLE = ${triStr};

export const VERTEX_OFFSETS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];

export const EDGE_V_MAP = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
`;
        fs.writeFileSync('src/marching/lut.js', out);
        console.log('lut.js rewritten successfully!');
    });
});
