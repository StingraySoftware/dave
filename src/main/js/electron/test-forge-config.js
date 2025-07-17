#!/usr/bin/env node
/**
 * Test Forge configuration for potential errors before building
 */

const config = require('./forge.config.js');
const path = require('path');
const fs = require('fs');

console.log('Testing Electron Forge configuration...\n');

// Test DMG configuration
const dmgConfig = config.makers.find(m => m.name === '@electron-forge/maker-dmg');
if (dmgConfig) {
  console.log('DMG Maker Configuration:');
  console.log(`   Title: "${dmgConfig.config.title}" (${dmgConfig.config.title.length} chars)`);
  
  if (dmgConfig.config.title.length > 27) {
    console.log('ERROR: DMG title too long (>27 chars)');
  } else {
    console.log('DMG title length OK');
  }
  
  // Test icon path
  const iconPath = dmgConfig.config.icon;
  if (fs.existsSync(iconPath)) {
    console.log('DMG icon exists');
  } else {
    console.log(`DMG icon missing: ${iconPath}`);
  }
  
  console.log('');
}

// Test DEB configuration  
const debConfig = config.makers.find(m => m.name === '@electron-forge/maker-deb');
if (debConfig) {
  console.log('DEB Maker Configuration:');
  console.log(`   Name: "${debConfig.config.options.name}"`);
  console.log(`   Description: "${debConfig.config.options.description}"`);
  
  // Test icon path
  const iconPath = debConfig.config.options.icon;
  if (fs.existsSync(iconPath)) {
    console.log('DEB icon exists');
  } else {
    console.log(`DEB icon missing: ${iconPath}`);
  }
  
  console.log('');
}

// Test RPM configuration
const rpmConfig = config.makers.find(m => m.name === '@electron-forge/maker-rpm');
if (rpmConfig) {
  console.log('RPM Maker Configuration:');
  console.log(`   Name: "${rpmConfig.config.options.name}"`);
  console.log(`   Description: "${rpmConfig.config.options.description}"`);
  
  // Test icon path
  const iconPath = rpmConfig.config.options.icon;
  if (fs.existsSync(iconPath)) {
    console.log('RPM icon exists');
  } else {
    console.log(`RPM icon missing: ${iconPath}`);
  }
  
  console.log('');
}

// Test Squirrel (Windows) configuration
const squirrelConfig = config.makers.find(m => m.name === '@electron-forge/maker-squirrel');
if (squirrelConfig) {
  console.log('Squirrel (Windows) Maker Configuration:');
  console.log(`   Name: "${squirrelConfig.config.name}"`);
  console.log(`   Description: "${squirrelConfig.config.description}"`);
  
  // Test icon path
  const iconPath = squirrelConfig.config.setupIcon;
  if (fs.existsSync(iconPath)) {
    console.log('Windows setup icon exists');
  } else {
    console.log(`Windows setup icon missing: ${iconPath}`);
  }
  
  console.log('');
}

// Test missing snap maker (should not exist)
const snapConfig = config.makers.find(m => m.name === '@electron-forge/maker-snap');
if (snapConfig) {
  console.log('ERROR: Snap maker found in config (should be removed)');
} else {
  console.log('Snap maker correctly removed from config');
}

console.log('\n Configuration validation complete!');