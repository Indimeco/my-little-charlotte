// TODO
// store parsed content in a database
// run comparisons on content and generate reports

// BUGS
// oldDestinations does not prevent visiting same site
// multiple same items being added to destinations

// MODULES
const
	request = require( 'request' ),
	cheerio = require( 'cheerio' ),
	url 		= require( 'url' );
	
// CONFIG
const
	origin 	= 'https://www.mlc.com.au/';

const requestOptions = {
	method: 'GET'
};

// GENERAL
const
	redText = `\x1b[31m%s\x1b[0m`,
	magentaText = `\x1b[35m%s\x1b[0m`,
	blueText = `\x1b[36m%s\x1b[0m`,
	yellowText = `\x1b[33m%s\x1b[0m`;

// MAIN
console.log( blueText, 'Spider is waking up in the drain spout...' );
crawl( origin );

function crawl( start ){
	let destinations = [start];
	let oldDestinations = []; // prevent looping same pages
	
	forward();
	
	function forward() {
		if ( destinations.length > 0 ){
			let current = destinations.length-1;
			let options = Object.assign({},requestOptions);
			options.url = destinations[current];
			
			request( options, ( err, response, body ) => {
				if (err) console.log( err )	
				else {
					console.log( magentaText, `Visiting ${ options.url }` );
					let $ = cheerio.load( body ) 
					oldDestinations.push( destinations.pop() );
				
					let content = harvestContent( $ );
					// console.log( magentaText, `Found content ${ content }` );
					let possibleDestinations = harvestDestinations( $ );
					// console.log( magentaText, `Found destinations ${ possibleDestinations }` );
					
					for ( let i=0; i<possibleDestinations.length; i++ ){
						if ( oldDestinations.indexOf( possibleDestinations[i] ) == -1){
							if ( destinations.indexOf( possibleDestinations[i] ) == -1) {
								destinations.push( possibleDestinations[i] );
					} } }
					
					console.log( yellowText, `Spider's visiting list \n ----- \n ${ destinations }` );
					console.log( `\n Spider's visiting history \n ----- \n ${ oldDestinations }` );
					setTimeout( forward, 400 );
		} } ) }
		else console.log( blueText, 'Spider ran out of web...' );
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
					// else console.log( redText,`REJECTED [[${text[j]}]]` ); 
				}
				// else console.log( redText,`COULD NOT VALIDATE [[${text[j]}]]` );
			}
		}
		
		return content;
}

function harvestDestinations( $ ){
	let aElements = $( 'a' );
	let links = [];
	for ( let i=0; i<aElements.length; i++ ) {
		let link = new URL( $( aElements[i] ).attr( 'href' ), origin );
		if ( isInternal( link ) ) links.push( link );
		else console.log( redText,`EXTERNAL LINK [[${link}]]` );
	}
	
	return links;
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
	const r = new RegExp( '^'+origin );
	return r.test( href );
}

// validate : a -> Boolean
function validate( input, type ){
	return input ? typeof input === type ? true : false : false; 
}