#!/usr/bin/env node

const API_URL = 'http://localhost:3000/api/v1';

async function testUploadAndGet() {
  try {
    console.log('=== Testing Upload and GET Results ===\n');
    
    // 1. Create launch
    console.log('1. Creating launch...');
    const createResponse = await fetch(`${API_URL}/launches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: 'Test Upload and Get Results',
        startTime: new Date().toISOString()
      })
    });
    
    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new Error(`Failed to create launch: ${createResponse.status} ${text}`);
    }
    
    const launchData = await createResponse.json();
    const launchId = launchData.data?.id;
    
    if (!launchId) {
      throw new Error('Launch ID not found in response');
    }
    
    console.log(`✓ Launch created: ${launchId}\n`);
    
    // 2. Prepare test result data
    const testResults = [
      {
        id: 'test-result-1',
        name: 'Test Case 1',
        fullName: 'com.example.TestClass#testCase1',
        status: 'passed',
        flaky: false,
        muted: false,
        known: false,
        hidden: false,
        historyId: 'history-1',
        testCaseId: 'test-case-1',
        start: Date.now() - 10000,
        stop: Date.now() - 5000,
        labels: [
          { name: 'suite', value: 'TestSuite' },
          { name: 'testClass', value: 'TestClass' },
          { name: 'testMethod', value: 'testCase1' }
        ],
        parameters: [],
        links: [],
        steps: [
          {
            name: 'Step 1',
            status: 'passed',
            start: Date.now() - 9000,
            stop: Date.now() - 7000,
            attachments: []
          }
        ],
        attachments: [],
        sourceMetadata: {
          readerId: 'test',
          metadata: {}
        }
      },
      {
        id: 'test-result-2',
        name: 'Test Case 2',
        fullName: 'com.example.TestClass#testCase2',
        status: 'failed',
        flaky: false,
        muted: false,
        known: false,
        hidden: false,
        historyId: 'history-2',
        testCaseId: 'test-case-2',
        start: Date.now() - 8000,
        stop: Date.now() - 3000,
        labels: [
          { name: 'suite', value: 'TestSuite' },
          { name: 'testClass', value: 'TestClass' },
          { name: 'testMethod', value: 'testCase2' }
        ],
        parameters: [],
        links: [],
        steps: [],
        attachments: [],
        sourceMetadata: {
          readerId: 'test',
          metadata: {}
        }
      }
    ];
    
    // 3. Upload test results
    console.log('2. Uploading test results...');
    const uploadResponse = await fetch(`${API_URL}/launches/${launchId}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testResults)
    });
    
    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(`Failed to upload results: ${uploadResponse.status} ${text}`);
    }
    
    const uploadData = await uploadResponse.json();
    console.log(`✓ Results uploaded: ${uploadData.data?.uploadedCount || testResults.length} results\n`);
    
    // 4. Get launch results (list)
    console.log('3. Getting launch results (list)...');
    const listResponse = await fetch(`${API_URL}/launches/${launchId}/results?page=1&limit=10`);
    
    if (!listResponse.ok) {
      const text = await listResponse.text();
      throw new Error(`Failed to get results list: ${listResponse.status} ${text}`);
    }
    
    const listData = await listResponse.json();
    console.log(`✓ Found ${listData.data?.length || 0} results`);
    console.log(`  Total: ${listData.total || 0}`);
    console.log(`  Page: ${listData.page || 1}`);
    console.log(`  Limit: ${listData.limit || 10}\n`);
    
    if (listData.data && listData.data.length > 0) {
      const firstResult = listData.data[0];
      const resultId = firstResult.id;
      
      // 5. Get single test result by ID
      console.log(`4. Getting test result by ID: ${resultId}...`);
      const getResponse = await fetch(`${API_URL}/test-results/${resultId}`);
      
      if (!getResponse.ok) {
        const text = await getResponse.text();
        console.log(`⚠ Failed to get result: ${getResponse.status} ${text}`);
      } else {
        const getData = await getResponse.json();
        console.log(`✓ Test result retrieved:`);
        console.log(`  ID: ${getData.data?.id}`);
        console.log(`  Name: ${getData.data?.name}`);
        console.log(`  Status: ${getData.data?.status}`);
        console.log(`  Full Name: ${getData.data?.fullName}\n`);
      }
      
      // 6. Get test result history
      if (firstResult.historyId) {
        console.log(`5. Getting test result history for historyId: ${firstResult.historyId}...`);
        const historyResponse = await fetch(`${API_URL}/test-results/${resultId}/history`);
        
        if (!historyResponse.ok) {
          const text = await historyResponse.text();
          console.log(`⚠ Failed to get history: ${historyResponse.status} ${text}`);
        } else {
          const historyData = await historyResponse.json();
          console.log(`✓ History retrieved: ${historyData.data?.length || 0} entries\n`);
        }
      }
    }
    
    // 7. Search test results
    console.log('6. Searching test results...');
    const searchResponse = await fetch(`${API_URL}/test-results/search?query=Test&page=1&limit=10`);
    
    if (!searchResponse.ok) {
      const text = await searchResponse.text();
      console.log(`⚠ Search failed: ${searchResponse.status} ${text}`);
    } else {
      const searchData = await searchResponse.json();
      console.log(`✓ Search results: ${searchData.data?.length || 0} found\n`);
    }
    
    // 8. Get launch details
    console.log('7. Getting launch details...');
    const launchGetResponse = await fetch(`${API_URL}/launches/${launchId}`);
    
    if (!launchGetResponse.ok) {
      const text = await launchGetResponse.text();
      console.log(`⚠ Failed to get launch: ${launchGetResponse.status} ${text}`);
    } else {
      const launchGetData = await launchGetResponse.json();
      console.log(`✓ Launch details:`);
      console.log(`  ID: ${launchGetData.data?.id}`);
      console.log(`  Name: ${launchGetData.data?.name}`);
      console.log(`  Test Results Count: ${launchGetData.data?.testResultsCount || 0}`);
      console.log(`  Statistic:`, JSON.stringify(launchGetData.data?.statistic || {}, null, 2));
    }
    
    console.log('\n✅ All tests completed!');
    console.log(`\nLaunch ID: ${launchId}`);
    console.log(`View in API: ${API_URL}/launches/${launchId}`);
    console.log(`View results: ${API_URL}/launches/${launchId}/results`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testUploadAndGet();
