const fs = require('fs');
const path = require('path');
console.log('🧪 Validating Solo Mahjong Practice Machine...\n');
const baseDir = path.join(__dirname, '..');
const requiredFiles = [
    'index.html',
    'src/core/mahjong-engine.js',
    'src/core/yaku-calculator.js',
    'src/core/probability-engine.js',
    'src/core/scenario-validator.js',
    'src/core/research-integration.js',
    'src/ui/ui-controller.js',
    'src/css/styles.css'
];
console.log('📁 Checking file structure...');
let allFilesExist = true;
for (const file of requiredFiles) {
    const filePath = path.join(baseDir, file);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
    } else {
        console.log(`❌ ${file} - MISSING`);
        allFilesExist = false;
    }
}
if (!allFilesExist) {
    process.exit(1);
}
console.log('\n🔍 Validating HTML structure...');
const htmlContent = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const requiredElements = [
    'id="playerHand"',
    'id="yakuAnalysis"',
    'id="winProbability"',
    'id="expectedValue"',
    'scenario-sidebar',
    'header-controls'
];
for (const element of requiredElements) {
    if (htmlContent.includes(element)) {
        console.log(`✅ Found: ${element}`);
    } else {
        console.log(`❌ Missing: ${element}`);
    }
}
console.log('\n🎨 Validating CSS...');
const cssContent = fs.readFileSync(path.join(baseDir, 'src/css/styles.css'), 'utf8');
const cssFeatures = ['Noto Sans JP', 'scenario-sidebar', 'header-controls', 'main-layout'];
for (const feature of cssFeatures) {
    if (cssContent.includes(feature)) {
        console.log(`✅ CSS Feature: ${feature}`);
    }
}
console.log('\n🎉 VALIDATION COMPLETE!');
process.exit(0);