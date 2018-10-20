(function(){
'use strict';

// GENERAL
const
	puppeteer	= require( 'puppeteer'	),
	fs 			= require( 'fs' 	 	),
	url			= require( 'url'		),
	
	redText 	= `\x1b[31m%s\x1b[0m`, // Errors (logs)
	magentaText = `\x1b[35m%s\x1b[0m`, // Crawl progress
	blueText 	= `\x1b[36m%s\x1b[0m`, // Spider status
	yellowText	= `\x1b[33m%s\x1b[0m`; // Warnings
	
// MAIN
const spider = {
	// Constructor
	Awaken: ( config ) => {
		console.log( blueText, 'Spider is waking up in the drain spout...' );
		let self 			= Object.create( spider ),
			decideMethod 	= {
				['explore']: self.explore,
				['routine']: self.routine
			};
		
		// Init
		self.browser 			= null;
		self.origin 			= '';
		self.destinations 		= [];
		self.nowDestinations 	= [];
		self.oldDestinations 	= [];
		self.output 			= {};
		self.errors 			= '';
		self.method 			= null;
		self.dataCallback 		= null;
		self.currentThreads		= 0;
	
		try {
			self.method			= decideMethod[typeof config.method !== 'undefined' ? config.method : 'explore']; // function name which defines how new destinations are discovered
			self.dataCallback 	= typeof config.dataCallback 		!== 'undefined' ? config.dataCallback : 'harvestContent'; // function that manipulates the harvested data before it stored
			self.handler		= typeof config.handler 			!== 'undefined' ? config.handler : null; // function that interacts with the page before data is harvested
			self.maxThreads		= typeof config.maxThreads 			!== 'undefined' ? config.maxThreads : 15; // number of simultaneous pages open in browser
			self.headless		= typeof config.headless 			!== 'undefined' ? config.headless : true; // browser is not visible to humans
			self.timeout		= typeof config.timeout 			!== 'undefined' ? config.timeout : 30000; // milliseconds before retry navigation
			self.maxRetries		= typeof config.maxRetries 			!== 'undefined' ? config.maxRetries : 3; // number of times spider will visit a 404 in hope of getting through
			self.errorPages 	= typeof config.errorPages 			!== 'undefined' ? config.errorPages : []; // array of known pages to treat as errors for retry and logging
			return self;
		}
		catch( err ){this.logError( `Failed to create spider: ${err}` );}
	},
	
	authenticate: async function( url, username, password ) {
		try {
			// Open login page
			const page = await this.browser.newPage();
			await page.goto( url, {waitUntil: ['networkidle0','domcontentloaded']} );

			// Simulate user
			const 	user 	= '#username',
					pass 	= '#password',
					submit 	= await page.$( '#submit_login' );
			await page.type( user,username );
			await page.type( pass,password );
			await submit.click();
			await page.waitForNavigation({waitUntil: ['networkidle0']}); // wait for authentication cookie to be given and to be taken to home
			console.log( blueText, `Authentication as: ${username}` );
			
			return this;
		}
		catch( err ){
			this.logError( `Failed to authenticate: ${err}` );
			this.authenticate( url, username, password );
		}
	},
	
	// Initialize spider's journey
	crawl: function( origin ){
		// Interpret origin from input as a single string
		// If origin input has multiple items add them to the queue
		this.origin 		= typeof origin == 'object' ? origin[0] : origin;
		this.destinations 	= typeof origin == 'object' ? origin : [origin];
		this.retries 		= this.maxRetries;
		this.retryQueue		= [];
		
		// Validate origin url and look for first move
		if ( new URL( this.origin ) ) {
			// create promise to be resolved when spider runs out of web
			this.crawling = new Promise( function( resolve, reject ) { 
				this.resolveCrawl = resolve; 
				this.rejectCrawl = reject; 
			}.bind( this ) );
			this.spinWeb();
			return this.crawling;
		}
		else this.logError( 'Invalid origin! Spider is on strike.' );
	},
	
	spinThread: async function( url ) {
		console.log( magentaText, `Visiting: "${url}"`);
			
		// Open new browser page
		let page = await this.browser.newPage();
		page.setDefaultNavigationTimeout( this.timeout );
			
		try {
			// Validate page and continue to harvest method
			const response = await page.goto( url, {waitUntil: ['domcontentloaded','networkidle2']} );
			const status = await response.status();
			if ( this.errorPages.indexOf( page.url() ) != -1 ){
				console.log( yellowText, `Known error page hit! Adding to retry queue: "${url}"` );
				this.retryQueue.unshift( url );
			}
			else if ( status == 200 || status == 302 || status == 304 ){
				if (this.handler) {await this.handler( page )};
				await this.method( page );
				// handle data as per user function or default
				this.storeData( url, await this.dataCallback( page ) );
			}
			else {
				if ( status == 404 ){
					this.retryQueue.unshift( url )
					if ( this.retries == 0 ){this.logError( `${status} error: ${url}` );} // Log remaining 404s
				}
				else {this.logError( `${status} error: ${url}` );} // Log unhandled status codes
			}
		
			await page.close();
			this.spinWeb( url );
			return this;
		}
		catch( err ) {
			console.log( yellowText,`${err}, Retrying at: "${url}"` );
			await page.close();
			this.spinThread( url );
		}

	},
	
	// Assess next movement
	spinWeb: function( previousUrl ) {
		try {	
			if ( previousUrl ){
				this.currentThreads--;
				remove( previousUrl, this.nowDestinations );
				this.oldDestinations.push( previousUrl );
				
				// Track progress in console
				let completed 	= this.oldDestinations.length,
					total 		= completed + this.destinations.length + this.nowDestinations.length;
				console.log( magentaText, `\t( ${Math.round((completed/total)*100)}% ) : ${completed} of ${total}`);
			}
			let current = this.destinations.length-1,
				url 	= this.destinations[current];
				
			// recursively cause the spider to keep moving
			if ( this.destinations.length > 0 ){
				// spin up to max threads and keep crawling
				for(let i = 0; this.currentThreads<this.maxThreads && i<this.destinations.length; i++){
					let nextUrl = this.destinations.pop();
					this.nowDestinations.push( nextUrl );
					this.currentThreads++;
					this.spinThread( nextUrl );
				}
			}
			
			if ( this.destinations.length === 0 && this.nowDestinations.length === 0 ){
				if ( this.retryQueue.length > 0 && this.retries > 0 ){
					console.log( blueText, `Initiating retry for ${this.retryQueue.length} items || Retry number: ${this.maxRetries-this.retries+1} of ${this.maxRetries}` );
					this.destinations = this.retryQueue;
					this.retryQueue = [];
					this.retries--;
					this.spinWeb();
				}
				else {
					console.log( blueText, 'Spider ran out of web...' );
					let total = this.oldDestinations.length + this.destinations.length + this.nowDestinations.length;
					this.logError( `End of web concluding at "${previousUrl}" with output length: ${Object.keys(this.output).length}` );
					return this.resolveCrawl();					
				}
			}
		}
		catch( err ) {
			this.logError( `Failed to spinweb: ${err}` );
		}
	},
	
	// Crawl a page and harvest data, adding found links to queue
	explore: async function( page ){
		try {
			// filter possibleDestinations to update destinations
			let possibleDestinations = await this.harvestDestinations( page );
			for ( let i=0; i<possibleDestinations.length; i++ ){
				if ( this.oldDestinations.indexOf( possibleDestinations[i] ) === -1 
				&& this.destinations.indexOf( possibleDestinations[i] ) === -1
				&& this.nowDestinations.indexOf( possibleDestinations[i] ) === -1 ) {
					this.destinations.push( possibleDestinations[i] );
			}	}
			return this;
		}
		catch( err ){this.logError( `Explore failed: ${err}` );}
	},
	
	// Crawl a page and harvest data, going only to designated pages
	// Not implemented for this project
	routine: function( page ){
		console.log('Routine method is not tested for this implementation of the spider');
		this.oldDestinations.push( this.destinations.pop() );

		// Delay spider's next visit
		setTimeout( this.spinWeb.bind( this ), 300 );
	},
	
	// harvestContent : Object -> Array
	harvestContent: function( page ){
		console.log( 'Default functionality for harvesting data not implemented, please use custom dataCallback' );
	},
	
	// Retuns an array of links from a puppeteer page object
	harvestDestinations: async function( page ){
		try {
			const hrefs = await page.evaluate( () => {
				const aElements = Array.from( document.querySelectorAll( 'a' ) );
				return aElements.map( a => a.href );
			});
		
			let links = [];
			for ( let i=0; i<hrefs.length; i++ ) {
				try {
					let link = baseUrl( new URL( cleanUrl( hrefs[i] ), this.origin ) );
					if ( isInternal( this.origin, link ) ) links.push( link.toString() );
				}
				catch( err ){this.logError( `Invalid url detected: "${err}"` )}
			}
			if(links.length == 0){this.logError( `Warning! links is zero for: ${page.url()}` )}
			return links;
		}
		catch( err ){this.logError( `harvestDestinations failed: ${err}` )}
	},
	
	// Adds a data entry to the spider
	storeData: function( key, data ){
		this.output[key] = data;
	},
	
	writeLogs: function(){
		try {fs.statSync('./logs').isDirectory();}
		catch ( err ){fs.mkdirSync('./logs');}
		try {
			let timestamp = Math.trunc( Date.now()/1000 );
			fs.writeFileSync( `logs/${timestamp}_OUTPUT.JSON`, JSON.stringify( this.output ) );
			fs.writeFileSync( `logs/${timestamp}_ERRORS.txt`, this.errors );
		}
		catch ( err ){this.logError( `Fatal error! Failed to cleanup: ${err}` )};
	},
	
	logError: function ( err ){
		console.log( redText, err );
		this.errors += err +';\n\n';
	},
	
	newBrowser: async function(){
		try {
			if (this.browser !== null){
				await this.browser.close();
			}
			this.browser = await puppeteer.launch({headless: this.headless});
			return this;
		}
		catch ( err ){logError(`Could not obtain new browser: ${err}`);}
	},
	
	sleep: async function(){
		console.log( blueText, 'Spider is settling down for the evening...' );
		try {
			this.writeLogs();
			await this.browser.close();
			return this;
		}
		catch( err ){ this.logError( `Fatal nightmare, spider and you are crying: ${err}` )};
	}
}

// cleanUrl : String -> String
// removes unneeded extensions which create duplicates in the data
function cleanUrl( text ){
	let cleaned = text;
	const undesirables = [
		/\s/g,
		/%20/g,
		// /.html/ig, // removing .html causes some pages to become inaccessable and only 404
		// /.htm/ig,
		/.xhtml/ig,
		/.jhtml/ig
	];
	
	for ( let i=0; i<undesirables.length; i++ ){
		cleaned = cleaned.replace( undesirables[i], '' );
	}
	return cleaned !== '' ? cleaned : null;
}

// isInternal : String -> Boolean
// Returns whether the beginning of the link is the same as the origin
function isInternal( origin, href ){
	const r = new RegExp( '^'+origin );
	return r.test( href );
}

// baseUrl : urlObj -> urlObj
// Removes query params, anchor links
function baseUrl( urlObj ){
	const options = {
		auth	: false,
		search	: false,
		fragment: false,
		unicode	: true
	};
	return url.format( urlObj, options );
}

// Mutates given arr by removing item
function remove( item, arr ){
	const index = arr.indexOf( item );
	arr.splice( index, 1 );
	return item;
}

// validate : a -> Boolean
function validate( input, type ){
	return input ? typeof input === type ? true : false : false; 
}

module.exports = spider;
})();
