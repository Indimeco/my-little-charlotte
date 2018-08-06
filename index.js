// TODO
// store parsed content in a database
// run comparisons on content and generate reports

// BUGS
// oldDestinations does not prevent visiting same site
// harvestDestinations does not correctly grab hrefs
// isInternal does not validate non-definitive urls i.e., '/help'

// MODULES
const
	request = require( 'request' ),
	cheerio = require( 'cheerio' ),
	url 		= require( 'url' );
	
// CONFIG
const
	origin 	= '';

const requestOptions = {
	method: 'GET'
};

// GENERAL
const
	redText = `\x1b[31m%s\x1b[0m`;
	magentaText = `\x1b[35m%s\x1b[0m`;
	blueText = `\x1b[34m\x1b[5m`

// MAIN
crawl( origin );
function crawl( origin ){
	console.log( blueText, 'Spider is waking up in the drain spout...' );
	let destinations = [origin];
	let oldDestinations = []; // prevent looping same pages
	
	let crawlMax = 3; // limit number of visited pages to control testing
	let j = 0;
	while ( destinations.length >= 1 && j !== crawlMax){
		let current = destinations.length-1;
		let options = Object.assign({},requestOptions);
		options.url = destinations[current];
		
		request( options, ( err, response, body ) => {
			console.log( magentaText, `Visiting ${ options.url }` );
			let $ = cheerio.load( body ) 
			oldDestinations.push( destinations.pop() );
		
			let content = harvestContent( $ );
			console.log( magentaText, `Found content ${ content }` );
			let possibleDestinations = harvestDestinations( $ );
			console.log( magentaText, `Found destinations ${ content }` );
			
			for ( let i=0; i<possibleDestinations.length; i++ ){
				if ( !oldDestinations.includes( possibleDestinations[i] ) ){
					destinations.push( possibleDestinations[i] );
				}
			}
		} );
		j++;
	}	
}

// harvestContent : Object -> Array
function harvestContent( $ ){
		let pElements = $( 'p' ); // select all p elements from the fetched HTML
		let content = [];
		for ( let i=0; i<pElements.length; i++ ) {
			let text = $( pElements[i] ).text( ).split('\n'); // divide the p content into array elements
			
			for ( let j=0; j<text.length; j++ ) {
				if ( validate( text[j], 'string' ) ) {
					let cleaned = cleanText( text[j] );
					if ( cleaned ) content.push( cleaned );
					else console.log( redText,`REJECTED [[${text[j]}]]` ); }
				else console.log( redText,`COULD NOT VALIDATE [[${text[j]}]]` );
			}
		}
		
		return content;
}

function harvestDestinations( $ ){
	let aElements = $( 'a' );
	let destinations = [];
	for ( let i=0; i<aElements.length; i++ ) {
		let link = $( aElements[i] ).attr( 'href' );
		if ( isInternal( link ) ) destinations.push( link );
		else console.log( redText,`EXTERNAL LINK [[${link}]]` );
	}
	
	return destinations;
}

// cleanText : String -> String
function cleanText( text ){
	const undesirables = [
		/\n+/g,
		/\s{2,}/g,
		/\t+/g,
		/\r+/g
	];
	
	for ( let i=0; i<undesirables.length; i++ ){
		text = text.replace( undesirables[i], '' );
	}
	return text !== '' ? text : null;
}

// isInternal : String -> Boolean
function isInternal( href ){
	const r = new RegExp( '/^'+origin+'/' );
	return r.test( href );
}

// validate : a -> Boolean
function validate( input, type ){
	return input ? typeof input === type ? true : false : false; 
}