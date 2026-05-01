import axios from 'axios';

async function testV2ex() {
  console.log('--- Testing V2EX Hot API ---');
  const API_URL = 'https://www.v2ex.com/api/topics/hot.json';
  
  try {
    const response = await axios.get(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    console.log('Status:', response.status);
    console.log('Is Array:', Array.isArray(response.data));
    
    if (Array.isArray(response.data)) {
      console.log(`Total topics fetched: ${response.data.length}`);
      console.log('First topic sample:');
      const first = response.data[0];
      console.log({
        id: first.id,
        title: first.title,
        node: first.node?.title,
        replies: first.replies
      });
    } else {
      console.log('Response data is not an array:', response.data);
    }
  } catch (error: any) {
    console.error('API Request Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

testV2ex();
