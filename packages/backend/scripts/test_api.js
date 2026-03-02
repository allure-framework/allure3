#!/usr/bin/env node

const API_URL = 'http://localhost:3000/api/v1';

async function testAPI() {
  try {
    console.log('Testing API...\n');
    
    // 1. Health check
    console.log('1. Health check:');
    const health = await fetch('http://localhost:3000/health');
    const healthData = await health.json();
    console.log(JSON.stringify(healthData, null, 2));
    console.log('');
    
    // 2. Create launch
    console.log('2. Creating launch:');
    const createResponse = await fetch(`${API_URL}/launches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: 'Allure Test Data Import',
        startTime: new Date().toISOString()
      })
    });
    
    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new Error(`Failed to create launch: ${createResponse.status} ${text}`);
    }
    
    const launchData = await createResponse.json();
    console.log(JSON.stringify(launchData, null, 2));
    
    const launchId = launchData.data?.id;
    if (!launchId) {
      throw new Error('Launch ID not found in response');
    }
    
    console.log(`\nLaunch created with ID: ${launchId}\n`);
    
    // 3. Get launch
    console.log('3. Getting launch:');
    const getResponse = await fetch(`${API_URL}/launches/${launchId}`);
    const getData = await getResponse.json();
    console.log(JSON.stringify(getData, null, 2));
    console.log('');
    
    // 4. List launches
    console.log('4. Listing launches:');
    const listResponse = await fetch(`${API_URL}/launches?page=1&limit=10`);
    const listData = await listResponse.json();
    console.log(`Total launches: ${listData.total || 0}`);
    console.log(`Launches in response: ${listData.data?.length || 0}`);
    console.log('');
    
    console.log('✅ API is working correctly!');
    console.log(`\nLaunch ID: ${launchId}`);
    console.log(`View launch: ${API_URL}/launches/${launchId}`);
    
    return launchId;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testAPI();
