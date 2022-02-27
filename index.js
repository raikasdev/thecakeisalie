import fs from 'fs';
import https from 'https';
import { GraphQLClient, gql } from 'graphql-request';

let lines = 0;

const parseFolder = (folder) => {
  const files = fs.readdirSync(folder).filter(file => !file.includes('.yarn') && !file.includes('.git'));
  files.filter(file => /\.(js|ts|jsx|tsx)$/.test(file)).forEach(file => {
    lines += fs.readFileSync(`${folder}/${file}`, 'utf8').split('\n').length;
  });
  // Use files array to find folders and run the parseFolder function on them
  files.filter(file => fs.lstatSync(`${folder}/${file}`).isDirectory()).forEach(file => {
    parseFolder(`${folder}/${file}`);
  });
}

parseFolder('./repo1');
parseFolder('./repo2');
parseFolder('./repo3');

const repos = ['rittaschool/ritta-server', 'rittaschool/shared', 'rittaschool/ritta-next'];
let languages = {};
let commits = 0;
const client = new GraphQLClient('https://api.github.com/graphql', {
  headers: {
    authorization: 'Basic ' + process.env.GITHUB_TOKEN,
  },
});

var bar = new Promise((resolve, reject) => {
  repos.forEach(async (repo, index) => {
    
    const query = gql`{
      repository(owner: "rittaschool", name: "${repo.split('/')[1]}") {
        name
        refs(first: 1, refPrefix: "refs/heads/") {
          edges {
            node {
              name
              target {
                ... on Commit {
                  id
                  history(first: 0) {
                    totalCount
                  }
                }
              }
            }
          }
        }
      }
    }`;

    const commitData = await client.request(query)
    console.log(commitData.repository.refs.edges[0].node.target.history.totalCount);
    commits += commitData.repository.refs.edges[0].node.target.history.totalCount;
    
    let data = '';
    https.get(`https://api.github.com/repos/${repo}/languages`, {
      headers: {
        'Authorization': 'Basic ' + process.env.GITHUB_TOKEN,
        'User-Agent': 'the-cake-is-a-lie; @raikasdev'
      }
    }, (res) => {
      res.on('data', (d) => {
        data += d;
      });
  
      res.on('end', () => {
        data = JSON.parse(data);
        Object.keys(data).forEach(
          (key) => {
            let value = data[key];
            if (languages[key]) {
              languages[key] += value;
            } else {
              languages[key] = value;
            }
          }
        )
        if (index == repos.length - 1) {
          resolve();
        }
      })
  
    }).on('error', (e) => {
      console.error(e);
      process.exit(-1);
    });
  });  
});

const getPercent = (min, max) => value => 100 * (value - min) / (max - min);

bar.then(() => {
  const randomLanguage = Object.keys(languages)[Math.floor(Math.random() * Object.keys(languages).length)];
  const max = Object.values(languages).reduce((partialSum, a) => partialSum + a, 0);
  const percentage = Math.round(getPercent(0, max)(languages[randomLanguage]) * 100) / 100;
  fs.writeFileSync('./data.json', JSON.stringify({ lines, language: { name: randomLanguage, percentage, }, commits }));
})
