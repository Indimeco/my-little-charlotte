// TODO
// store parsed content in a database
// expand data collection to include other HTML content elements
// run comparisons on content and generate reports
// obey Robots.txt
	
// CONFIG
const config = {
	origin: 'https://www.mlc.com.au/',

	requestOptions: {
		method: 'GET'
	}
}

const spider  = require( './spider.js' );

// Main
let myLittleCharlotte = spider.awaken( config );
myLittleCharlotte.crawl( );