// TODO
// harvest links and add to array to call more requests
// store parsed content in a database
// run comparisons on content and generate reports

// MODULES
const
	request = require( 'request' ),
	cheerio = require( 'cheerio' ),
	url 		= require( 'url' );
	
// CONFIG
const
	origin 	= '';

const options = {
	url: origin,
	method: 'GET'
};

// GENERAL
const
	redText = `\x1b[31m%s\x1b[0m`;

// MAIN
request( options, ( err, response, body ) => {
	const $ = cheerio.load( body ); // convert HTML string into JS object
	
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
	
	console.log( content ); // Do something with the array of content
} );

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

// validate : a -> Boolean
function validate( input, type ){
	return input ? typeof input === type ? true : false : false; 
}