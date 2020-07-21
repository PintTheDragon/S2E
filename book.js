const fs = require('fs');
const showdown  = require('showdown');

const converter = new showdown.Converter();

const name = "r/nosleep Collection";
const uuid = "397c21b8e1f24d0fa3377fc6c722ec48";

let lines = JSON.parse(fs.readFileSync('nosleep.json'));
let linesMan = [];
let authorsMan = [];
let authors = {};
lines.forEach(line => {
	if(line["author"] === "[deleted]" || line["selftext"] === "[removed]" || line["selftext"].length < 1000) return;
	if(!authors.hasOwnProperty(line["author"])){
		authors[line["author"]] = [];
		authorsMan.push(line["author"]);
	}
	authors[line["author"]].push([line["id"], line["title"]]);
	
	var post = line["selftext"];
	
	let postmatch = post.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9@:;%_\+.~#?&//=]*)/g);
	if(postmatch !== null)
	postmatch.forEach(match => {
		const url = new URL(match);
		if(url.pathname.substr(url.pathname.length-1) == "/") url.pathname = url.pathname.substr(0, url.pathname.length-1);
		let text = "";
		if(url.hostname == "www.reddit.com" || url.hostname == "reddit.com"){
			let exec = /\/r\/[^\/]*\/comments\/([^\/]*)/g.exec(url.pathname);
			let exec1 = /\/comments\/([^\/]*)/g.exec(url.pathname);
			if(exec) text = exec[1];
			else if(exec1) text = exec1[1];
		}
		else if(url.hostname == "redd.it" || url.hostname == "www.redd.it" || url.hostname == "reddit.app.link"){
			let exec = /\/([^\/]*)/g.exec(url.pathname);
			if(exec) text = exec[1];
		}
		if(text != "") post = post.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9@:;%_\+.~#?&//=]*)/, text+".xhtml");
		else post = post.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9@:;%_\+.~#?&//=]*)/, line["id"]+".xhtml");
	});
	post = converter.makeHtml(post);
	
	let newp = "";
	post.split("\n").forEach(p => {
	if((p.trim() == "&#x200B;" || p.trim() == "&amp;#x200B;") || p.trim() == "") p = "​";
	newp+="<p>"+p+"</p>";	
	});
	newp.replace(/&#x200B;/g, "​");
	newp.replace(/&amp;#x200B;/g, "​");
	
	
	let text = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${line["title"]}</title>
</head>
<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
<h1 style="text-align: center;">${line["title"]}</h1>
<h2 style="text-align: center;">By <a href="../author/${line["author"]}.xhtml">${line["author"]}</a></h2>
${newp}
</body>
</html>`;
	
	linesMan.push([line["id"], line["title"]]);
	fs.writeFileSync("book/OEBPS/post/"+line["id"]+".xhtml", text);
});

Object.keys(authors).forEach(author => {
	let list = "";
	authors[author].forEach(post => {
		list+="<a href=\"../post/"+post[0]+".xhtml\">"+post[1]+"</a><br/>";
	});
	let text = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${author}</title>
</head>
<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
<h1 style="text-align: center;">${author}</h1>
${list}
</body>
</html>`;
	fs.writeFileSync("book/OEBPS/author/"+author+".xhtml", text);
});

fs.writeFileSync("book/OEBPS/Content.opf", content());
fs.writeFileSync("book/OEBPS/toc.ncx", toc());
fs.writeFileSync("book/OEBPS/title.xhtml", title());
fs.writeFileSync("book/OEBPS/authors.xhtml", authorsPage());
fs.writeFileSync("book/OEBPS/posts.xhtml", postsPage());
fs.writeFileSync("book/OEBPS/toc.xhtml", tocXHTML());

function content(){
	let manifest = "        <item id=\"ncx\" href=\"toc.ncx\" media-type=\"application/x-dtbncx+xml\" />\n        <item id=\"title\" href=\"title.xhtml\" media-type=\"application/xhtml+xml\" />\n        <item id=\"authors\" href=\"authors.xhtml\" media-type=\"application/xhtml+xml\" />\n        <item id=\"posts\" href=\"posts.xhtml\" media-type=\"application/xhtml+xml\" />\n        <item id=\"toc\" href=\"toc.xhtml\" media-type=\"application/xhtml+xml\" />\n";
	let spine = "<itemref idref=\"title\" linear=\"yes\" />\n<itemref idref=\"toc\" linear=\"yes\" />\n";
	linesMan.forEach(line => {
		manifest+=`        <item id="${line[0]}" href="post/${line[0]}.xhtml" media-type="application/xhtml+xml" />\n`;
		spine+=`        <itemref idref="${line[0]}" linear="no" />\n`;
	});
	authorsMan.forEach(author => {
		manifest+=`        <item id="${author}" href="author/${author}.xhtml" media-type="application/xhtml+xml" />\n`;
		spine+=`        <itemref idref="${author}" linear="no" />\n`;
	});
	spine+="<itemref idref=\"posts\" linear=\"yes\" />\n<itemref idref=\"authors\" linear=\"yes\" />\n";
	return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0" >
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${name}</dc:title>
        <dc:language>en-US</dc:language>
        <dc:identifier id="BookID" opf:scheme="UUID">${uuid}</dc:identifier>
    </metadata>
    <manifest>
${manifest}
    </manifest>
    <spine toc="ncx">
${spine}
    </spine>
</package>`;
}

function toc(){
	let navs = "";
	navs += `    <navPoint id="title" playOrder="1">
        <navLabel>
            <text>${name}</text>
        </navLabel>
        <content src="title.xhtml"/>
    </navPoint>
`;
		navs += `    <navPoint id="toc" playOrder="2">
        <navLabel>
            <text>Table of Contents</text>
        </navLabel>
        <content src="toc.xhtml"/>
    </navPoint>
`;
	navs += `    <navPoint id="posts" playOrder="3">
        <navLabel>
            <text>Posts</text>
        </navLabel>
        <content src="posts.xhtml"/>
    </navPoint>
`;
	navs += `    <navPoint id="authors" playOrder="4">
        <navLabel>
            <text>Authors</text>
        </navLabel>
        <content src="authors.xhtml"/>
    </navPoint>
`;
	
	return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">

<head>
    <meta name="dtb:uid" content="${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
</head>

<docTitle>
    <text>${name}</text>
</docTitle>
${navs}
</navMap>
</ncx>`;
}

function title(){
	return `
	<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${name}</title>
</head>
<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
<h1>${name}</h1>
<a href="posts.xhtml">Posts</a>
<br/>
<a href="authors.xhtml">Authors</a>
</body>
</html>
	`;
}

function postsPage(){
	let post = "";
	linesMan.forEach(line => {
		post += `<p><a href="post/${line[0]}.xhtml">${line[1]}</a></p><br/>`;
	});
	
	return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Posts</title>
</head>
<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
<h1 style="text-align: center;">Posts</h1>
${post}
</body>
</html>`;
}

function authorsPage(){
	let post = "";
	authorsMan.forEach(author => {
		post += `<p><a href="author/${author}.xhtml">${author}</a></p><br/>`;
	});
	
	return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Authors</title>
</head>
<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
<h1 style="text-align: center;">Authors</h1>
${post}
</body>
</html>`;
}

function tocXHTML(){
	let items = "";
	items += `<li><a href="title.xhtml">${name}</a></li>\n`;
	items += `<li><a href="toc.xhtml">Table of Contents</a></li>\n`;
	
	let postsList = "";
	linesMan.forEach(line => {
		postsList += `<li><a href="post/${line[0]}.xhtml">${line[1]}</a></li>\n`;
	});
	items += `<li><a href="posts.xhtml">Posts</a><ol>${postsList}</ol></li>\n`;
	
	let authorsList = "";
	authorsMan.forEach(author => {
		authorsList += `<li><a href="author/${author}.xhtml">${author}</a></li>\n`;
	});
	items += `<li><a href="authors.xhtml">Authors</a><ol>${authorsList}</ol></li>`;
	
	return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Authors</title>
</head>
<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
<nav role="doc-toc" epub:type="toc" id="toc">
<h2>Table of Contents</h2>
<ol>
${items}
</ol>
</nav>
</body>
</html>`;
}