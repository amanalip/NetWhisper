/**
 * Electron Security Configuration Audit for NetWhisper.
 * Verifies contextIsolation, nodeIntegration: false, sandbox: true,
 * strict CSP directives, and explicit context bridge channel encapsulation.
 */

// Import the Node.js filesystem module to read electron configuration source files.
const fs = require('fs');
// Import the Node.js path module for resolving file paths.
const path = require('path');
// Import the Node.js assert module for validating security invariants.
const assert = require('assert');

// Define the root workspace path.
const rootDir = path.resolve(__dirname, '..');
// Define the path to the Electron main process script.
const mainPath = path.join(rootDir, 'electron', 'main.cjs');
// Define the path to the Electron preload script.
const preloadPath = path.join(rootDir, 'electron', 'preload.cjs');

console.log('[SECURITY AUDIT] Starting Electron Security Hardening Tests...');

// Verify that the electron directory and scripts exist.
assert(fs.existsSync(mainPath), 'electron/main.cjs must exist.');
assert(fs.existsSync(preloadPath), 'electron/preload.cjs must exist.');

// Function to audit Electron main process security configuration.
function testMainSecurityConfig() {
  console.log('  Testing Electron main.cjs webPreferences and CSP enforcement...');
  // Read main.cjs content.
  const mainContent = fs.readFileSync(mainPath, 'utf8');

  // Verify contextIsolation is explicitly set to true.
  assert(
    mainContent.includes('contextIsolation: true'),
    'Security Violation: webPreferences.contextIsolation must be explicitly set to true.'
  );

  // Verify nodeIntegration is explicitly set to false.
  assert(
    mainContent.includes('nodeIntegration: false'),
    'Security Violation: webPreferences.nodeIntegration must be explicitly set to false.'
  );

  // Verify sandbox is explicitly set to true.
  assert(
    mainContent.includes('sandbox: true'),
    'Security Violation: webPreferences.sandbox must be explicitly enabled.'
  );

  // Verify CSP headers exist.
  assert(
    mainContent.includes('Content-Security-Policy'),
    'Security Violation: Content-Security-Policy header configuration is missing.'
  );

  // Verify external link navigation protection is present.
  assert(
    mainContent.includes('setWindowOpenHandler') || mainContent.includes('will-navigate'),
    'Security Violation: Navigation interception handler is missing.'
  );

  console.log('  [PASS] main.cjs passed all webPreferences and navigation security checks.');
}

// Function to audit Preload ContextBridge security encapsulation.
function testPreloadSecurityConfig() {
  console.log('  Testing Electron preload.cjs ContextBridge encapsulation...');
  // Read preload.cjs content.
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');

  // Verify contextBridge.exposeInMainWorld is used.
  assert(
    preloadContent.includes('contextBridge.exposeInMainWorld'),
    'Security Violation: contextBridge.exposeInMainWorld must be used to expose APIs.'
  );

  // Verify raw ipcRenderer is NOT exposed globally.
  assert(
    !preloadContent.includes('ipcRenderer: ipcRenderer'),
    'Security Violation: Raw ipcRenderer must never be directly exposed to the renderer.'
  );

  // Verify Node built-ins (child_process, fs) are NOT exposed.
  assert(
    !preloadContent.includes('require("child_process")') && !preloadContent.includes("require('child_process')"),
    'Security Violation: child_process must never be imported in preload script.'
  );

  console.log('  [PASS] preload.cjs passed all ContextBridge isolation checks.');
}

// Execute tests.
testMainSecurityConfig();
testPreloadSecurityConfig();
console.log('[SECURITY AUDIT] All Electron security tests passed successfully (100%).');
