const fs = require('fs');
const showdown = require('showdown');
const request = require('sync-request');
const path = require("path");

const converter = new showdown.Converter();

let name = null;
let uuid = null;
let subreddit = null;
let minChars = 1000;
let file = null;
let threshold = 3;

try {
    let args = process.argv.slice(2);
    if (args.length < 4) fail();
    name = args[0];
    uuid = args[1];
    subreddit = args[2];
    file = args[3];
    if (args.length < 5)
        minChars = parseInt(args[4]);
    if (args.length < 6)
        threshold = parseInt(args[5]);
    if (!name || !uuid || !subreddit || !file) fail();
} catch (e) {
    console.log(e);
    fail();
}

function fail() {
    console.log("Usage: node book.js \"book title\" \"uuid\" \"subreddit\" \"file.json\" [minChars] [scoreThreshold]\n");
    console.log("Example: node book.js \"r/nosleep Collection\" \"asmnfdkjhf78dhndj\" \"nosleep\" \"nosleep.json\" 1000 3");
    process.exit();
}

let lines = JSON.parse("[" + fs.readFileSync(file, "utf8").replace(/\r?\n|\r/g, ",").slice(0, -1) + "]");
let linesMan = [];
let authorsMan = [];
let authors = {};
let links = [];
let ids = [];
let authorNum = {};
let refs = [];
let downloadImgArr = [];
let imgArr = [];
let flairs = {};
let flairsMan = [];
let flairNum = {};

console.log("Creating folders");
createDir("book");
createDir("book/OEBPS");
createDir("book/META-INF");
createDir("book/OEBPS/post");
createDir("book/OEBPS/post/image");
createDir("book/OEBPS/author");
createDir("book/OEBPS/flair");

console.log("Adding archived posts");
lines.forEach(line => addLine(line, false));

(async () => {
    console.log("Downloading references from pushshift");
    await download();

    console.log("Downloading missed posts");
    while (findNull()) await download();

    console.log("Downloading images");
    await downloadImages();

    console.log("Adding authors");
    Object.keys(authors).forEach(addAuthor);

    console.log("Adding flairs");
    Object.keys(flairs).forEach(addFlair);

    console.log("Sorting posts");
    linesMan.sort((x, y) => y[2] - x[2]);

    console.log("Sorting authors");
    authorsMan.sort((x, y) => authorNum[y] - authorNum[x]);

    console.log("Sorting flairs");
    flairsMan.sort((x, y) => flairNum[y] - flairNum[x]);

    console.log("Writing epub files");
    fs.writeFileSync("book/OEBPS/Content.opf", content());
    //fs.writeFileSync("book/OEBPS/toc.ncx", toc());
    fs.writeFileSync("book/OEBPS/title.xhtml", title());
    fs.writeFileSync("book/OEBPS/authors.xhtml", authorsPage());
    fs.writeFileSync("book/OEBPS/posts.xhtml", postsPage());
    fs.writeFileSync("book/OEBPS/toc.xhtml", tocXHTML());
    fs.writeFileSync("book/OEBPS/style.css", genCSS());
    fs.writeFileSync("book/OEBPS/script.js", genJS());
    fs.writeFileSync("book/META-INF/container.xml", genContainer());
    fs.writeFileSync("book/mimetype", "application/epub+zip");
    fs.writeFileSync("book/archive.bat", genArchive());
    fs.writeFileSync("book/flairs.xhtml", flairsPage());
})();

function findNull() {
    let flag = false;
    linesMan.forEach((line) => {
        if (!fs.existsSync("book/OEBPS/post/" + line + ".xhtml")) {
            removeA(ids, line);
            if (!links.includes(line)) links.push(line);
            flag = true;
        }
    });
}

async function download() {
    let flag = true;
    let reqNum = 0;
    while (flag) {
        flag = false;
        let idsQ = "";
        for (var i = 0; i < links.length; i++) {
            if (ids.includes(links[i]) && !refs.includes(links[i])) continue;
            idsQ += links[i] + ",";
        }
        if (idsQ == "") break;
        idsQ = idsQ.substr(1);
        let json = JSON.parse(request('GET', 'https://api.pushshift.io/reddit/search/submission/?subreddit=' + subreddit + '&ids=' + idsQ).getBody());
        if (json["data"].length == 0) break;
        console.log("    Downloading " + idsQ.slice(0, -1));
        flag = true;
        json["data"].forEach(line => addLine(line, true));
        await sleep(1000);
        reqNum++;
        if (reqNum > 150) {
            await sleep(60000);
            reqNum = 0;
        }
    }
}

function addAuthor(author) {
    let list = "";
    let amount = 0;
    authors[author].forEach(post => {
        list += "<a href=\"../post/" + post[0] + ".xhtml\">" + post[1] + "</a><br/>";
        amount += post[2];
    });
    authorNum[author] = amount;
    let text = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
	<head>
		<link rel="stylesheet" href="../style.css"></link>
		<script type="text/javascript" src="../script.js"></script>
		<title/>
	</head>
	<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
		<h1 style="text-align: center;">${author}</h1>
		${list}
	</body>
</html>`;
    fs.writeFileSync("book/OEBPS/author/" + author.replace(/[^a-z0-9_-]/gi, '_') + ".xhtml", text);
}

function addFlair(flair) {
    let list = "";
    let amount = 0;
    flairs[flair].forEach(post => {
        list += "<a href=\"../post/" + post[0] + ".xhtml\">" + post[1] + "</a><br/>";
        amount += post[2];
    });
    flairNum[flair] = amount;
    let text = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
	<head>
		<link rel="stylesheet" href="../style.css"></link>
		<script type="text/javascript" src="../script.js"></script>
		<title/>
	</head>
	<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
		<h1 style="text-align: center;">${flair}</h1>
		${list}
	</body>
</html>`;
    fs.writeFileSync("book/OEBPS/flair/" + flair.replace(/[^a-z0-9_-]/gi, '_') + ".xhtml", text);
}

function addLine(line, ref) {
    let text = '';
    if (line["subreddit"] !== subreddit || line["stickied"] || line["author"] === "[deleted]" || line["selftext"] === "[removed]" || (line["selftext"] != "" && line["selftext"].length < minChars) || (line["score"] < threshold && !ref)) {
        if (line["score"] < threshold && !ref) refs.push(line["id"]);
        ids.push(line["id"]);
        if (refs.includes(line["id"]) && ref) removeA(refs, line["id"]);
        return;
    }
    if (!authors.hasOwnProperty(line["author"])) {
        authors[line["author"]] = [];
        authorsMan.push(line["author"]);
    }
    let flag1 = true;
    authors[line["author"]].forEach(a => {
        if (a[0] == line["id"]) flag1 = false;
    });
    if (flag1)
        authors[line["author"]].push([line["id"], line["title"], line["score"]]);


    if (line["link_flair_text"]) {
        if (!flairs.hasOwnProperty(line["link_flair_text"])) {
            flairs[line["link_flair_text"]] = [];
            flairsMan.push(line["link_flair_text"]);
        }
        flag1 = true;
        flairs[line["link_flair_text"]].forEach(a => {
            if (a[0] == line["id"]) flag1 = false;
        });
        if (flag1)
            flairs[line["link_flair_text"]].push([line["id"], line["title"], line["score"]]);
    }

    if (line["post_hint"] == "self") {
        var post = line["selftext"].replace(/\\/g, "");

        let postmatch = post.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9@:;%_\+.~#?&//=]*)/g);
        if (postmatch !== null)
            postmatch.forEach(match => {
                const url = new URL(match);
                if (url.pathname.substr(url.pathname.length - 1) == "/") url.pathname = url.pathname.substr(0, url.pathname.length - 1);
                let text = "";
                if (url.hostname == "www.reddit.com" || url.hostname == "reddit.com") {
                    let exec = /\/r\/[^\/]*\/comments\/([^\/]*)/g.exec(url.pathname);
                    let exec1 = /\/comments\/([^\/]*)/g.exec(url.pathname);
                    if (exec) text = exec[1];
                    else if (exec1) text = exec1[1];
                } else if (url.hostname == "redd.it" || url.hostname == "www.redd.it" || url.hostname == "reddit.app.link") {
                    let exec = /\/([^\/]*)/g.exec(url.pathname);
                    if (exec) text = exec[1];
                }
                if (text != "") {
                    if (!links.includes(text)) links.push(text);
                    post = post.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9@:;%_\+.~#?&//=]*)/, text + ".xhtml");
                } else post = post.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9@:;%_\+.~#?&//=]*)/, line["id"] + ".xhtml");
            });
        post = converter.makeHtml(post);

        let newp = "";
        post.split("\n").forEach(p => {
            if ((p.trim() == "&#x200B;" || p.trim() == "&amp;#x200B;") || p.trim() == "") p = "​";
            newp += p;
        });
        newp = newp.replace(/&#x200B;/g, "​");
        newp = newp.replace(/&amp;#x200B;/g, "​");


        text = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
	<head>
		<link rel="stylesheet" href="../style.css"></link>
		<script type="text/javascript" src="../script.js"></script>
		<title/>
	</head>
	<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
		<h1 style="text-align: center;">${line["link_flair_text"] ? "<a href=\"../flair/"+line["link_flair_text"].replace(/[^a-z0-9_-]/gi, '_')+".xhtml\"><span"+(line["link_flair_background_color"] != "" ? " style=\"background-color: "+line["link_flair_background_color"]+";\"" : "")+" class=\"flair\">"+line["link_flair_text"]+"</span></a>" : ""}${line["title"]}</h1>
		<h2 style="text-align: center;">By <a href="../author/${line["author"].replace(/[^a-z0-9_-]/gi, '_')}.xhtml">${line["author"]}</a></h2>
		<div class="${line["over_18"] ? "blur" : ""}" ${line["over_18"] ? "onclick=\"blurr(this);\"" : ""}>${newp}</div>
	</body>
</html>`;
    } else if (line["post_hint"] == "image") {
        downloadImgArr.push(line["url"]);
        text = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
	<head>
		<link rel="stylesheet" href="../style.css"></link>
		<script type="text/javascript" src="../script.js"></script>
		<title/>
	</head>
	<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
		<h1 style="text-align: center;">${line["link_flair_text"] ? "<a href=\"../flair/"+line["link_flair_text"].replace(/[^a-z0-9_-]/gi, '_')+".xhtml\"><span"+(line["link_flair_background_color"] != "" ? " style=\"background-color: "+line["link_flair_background_color"]+";\"" : "")+" class=\"flair\">"+line["link_flair_text"]+"</span></a>" : ""}${line["title"]}</h1>
		<h2 style="text-align: center;">By <a href="../author/${line["author"].replace(/[^a-z0-9_-]/gi, '_')}.xhtml">${line["author"]}</a></h2>
		<img class="${line["over_18"] ? "blur" : ""}" src="${"image/"+path.basename(line["url"])}" ${line["over_18"] ? "onclick=\"blurr(this);\"" : ""}></img>
	</body>
</html>`;
    } else return;
    let flag2 = true;
    linesMan.forEach(a => {
        if (a[0] == line["id"]) flag2 = false;
    });
    if (flag2)
        linesMan.push([line["id"], line["title"], line["score"]]);
    fs.writeFileSync("book/OEBPS/post/" + line["id"] + ".xhtml", text);
    ids.push(line["id"]);
    if (refs.includes(line["id"])) removeA(refs, line["id"]);
}

async function downloadImages() {
    for (var i = 0; i < downloadImgArr.length; i++) {
        if (fs.existsSync("book/OEBPS/post/image/" + path.basename(downloadImgArr[i]))) {
            imgArr.push([path.basename(downloadImgArr[i], path.extname(downloadImgArr[i])), path.basename(downloadImgArr[i]), path.extname(downloadImgArr[i])]);
            continue;
        }
        try {
            fs.writeFileSync("book/OEBPS/post/image/" + path.basename(downloadImgArr[i]), request('GET', downloadImgArr[i], {
                encoding: 'binary'
            }).getBody(), 'binary');
            imgArr.push([path.basename(downloadImgArr[i], path.extname(downloadImgArr[i])), path.basename(downloadImgArr[i]), path.extname(downloadImgArr[i])]);
            await sleep(1000);
        } catch (e) {};
    }
}

function content() {
    let manifest = "        <item id=\"toc\" properties=\"nav\" href=\"toc.xhtml\" media-type=\"application/xhtml+xml\" />\n        <item id=\"title\" href=\"title.xhtml\" media-type=\"application/xhtml+xml\" />\n        <item id=\"authors\" href=\"authors.xhtml\" media-type=\"application/xhtml+xml\" />\n        <item id=\"posts\" href=\"posts.xhtml\" media-type=\"application/xhtml+xml\" />\n        <item id=\"style\" href=\"style.css\" media-type=\"text/css\"/>\n        <item id=\"script\" href=\"script.js\" media-type=\"text/javascript\"/>\n        <item id=\"flairs\" href=\"flairs.xhtml\" media-type=\"application/xhtml+xml\" />\n";
    let spine = "<itemref idref=\"title\" linear=\"yes\" />\n<itemref idref=\"toc\" linear=\"yes\" />\n";
    linesMan.forEach(line => {
        manifest += `        <item id="${line[0]}" href="post/${line[0]}.xhtml" media-type="application/xhtml+xml" properties="scripted" />\n`;
        spine += `        <itemref idref="${line[0]}" linear="no" />\n`;
    });
    authorsMan.forEach(author => {
        manifest += `        <item id="${author.replace(/[^a-z0-9_-]/gi, '_')}" href="author/${author.replace(/[^a-z0-9_-]/gi, '_')}.xhtml" media-type="application/xhtml+xml" properties="scripted" />\n`;
        spine += `        <itemref idref="${author.replace(/[^a-z0-9_-]/gi, '_')}" linear="no" />\n`;
    });
    flairsMan.forEach(flair => {
        manifest += `        <item id="${flair.replace(/[^a-z0-9_-]/gi, '_')}" href="flair/${flair.replace(/[^a-z0-9_-]/gi, '_')}.xhtml" media-type="application/xhtml+xml" properties="scripted" />\n`;
        spine += `        <itemref idref="${flair.replace(/[^a-z0-9_-]/gi, '_')}" linear="no" />\n`;
    });
    imgArr.forEach(img => {
        manifest += `        <item id="${img[0]}" href="post/image/${img[2]}" media-type="image/${img[1]}" />\n`;
    });
    spine += "<itemref idref=\"posts\" linear=\"yes\" />\n<itemref idref=\"authors\" linear=\"yes\" />\n";
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
    <spine>
${spine}
    </spine>
</package>`;
}

function toc() {
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
    navs += `    <navPoint id="flairs" playOrder="3">
        <navLabel>
            <text>Flairs</text>
        </navLabel>
        <content src="flair.xhtml"/>
    </navPoint>
`;
    navs += `    <navPoint id="posts" playOrder="4">
        <navLabel>
            <text>Posts</text>
        </navLabel>
        <content src="posts.xhtml"/>
    </navPoint>
`;
    navs += `    <navPoint id="authors" playOrder="5">
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

function title() {
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
<br/>
<a href="flairs.xhtml">Flairs</a>
</body>
</html>
	`;
}

function postsPage() {
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

function authorsPage() {
    let post = "";
    authorsMan.forEach(author => {
        post += `<p><a href="author/${author.replace(/[^a-z0-9_-]/gi, '_')}.xhtml">${author}</a></p><br/>`;
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

function flairsPage() {
    let post = "";
    flairsMan.forEach(flair => {
        post += `<p><a href="flair/${flair.replace(/[^a-z0-9_-]/gi, '_')}.xhtml">${flair}</a></p><br/>`;
    });

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Flairs</title>
</head>
<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
<h1 style="text-align: center;">Flairs</h1>
${post}
</body>
</html>`;
}


function tocXHTML() {
    let items = "";
    items += `<li><a href="title.xhtml">${name}</a></li>\n`;
    items += `<li><a href="toc.xhtml">Table of Contents</a></li>\n`;

    let flairsList = "";
    flairsMan.forEach(flair => {
        flairsList += `<li><a href="flair/${flair.replace(/[^a-z0-9_-]/gi, '_')}.xhtml">${flair}</a></li>\n`;
    });
    items += `<li><a href="flairs.xhtml">Flairs</a><ol>${flairsList}</ol></li>`;

    let postsList = "";
    linesMan.forEach(line => {
        postsList += `<li><a href="post/${line[0]}.xhtml">${line[1]}</a></li>\n`;
    });
    items += `<li><a href="posts.xhtml">Posts</a><ol>${postsList}</ol></li>\n`;

    let authorsList = "";
    authorsMan.forEach(author => {
        authorsList += `<li><a href="author/${author.replace(/[^a-z0-9_-]/gi, '_')}.xhtml">${author}</a></li>\n`;
    });
    items += `<li><a href="authors.xhtml">Authors</a><ol>${authorsList}</ol></li>`;

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Table of Contents</title>
</head>
<body style="margin-left:2%;margin-right:2%;margin-top:2%;margin-bottom:2%">
<nav role="doc-toc" epub:type="toc" id="toc">
<h2>Table of Contents</h2>
<ol epub:type="list">
${items}
</ol>
</nav>
</body>
</html>`;
}

function genCSS() {
    return `
	.blur{
	filter: blur(40px);
	border-style: solid;
	border-color: red;
	}
	
	.flair {
	color: #000000;
	border-radius: 20px;
	padding: 2px 8px;
	font-weight: 500;
	display: inline-block;
	margin-right: 5px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: pre;
	word-break: normal;
	margin-left: 0;
	margin: 0;
	font: inherit;
	font-size: inherit;
	font-size: 12px;
	line-height: 16px;
	}
	`;
}

function genJS() {
    return `function blurr(el){
	if(el.classList.contains("blur")) el.classList.remove("blur");
	else el.classList.add("blur");
	}`;
}

function genContainer() {
    return `<?xml version="1.0" encoding="UTF-8"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
<rootfiles>
<rootfile full-path="OEBPS/Content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>`;
}

function genArchive() {
    return `rm book.epub
7z a -tzip book.epub mimetype -mx0
7z a -tzip book.epub META-INF/ -mx5
7z a -tzip book.epub OEBPS/ -mx5
7z a -tzip book.epub OEBPS/post/image/ -mx9
7z a -tzip book.epub OEBPS/post/ -mx5
7z a -tzip book.epub OEBPS/author/ -mx5`;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function removeA(arr) {
    var what, a = arguments,
        L = a.length,
        ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax = arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}

function createDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
}