# How to Contribute

First of all, thanks for considering contributing! ✨ It's people like you that make open-source tools awesome. 💖

At Stoplight, we want contributing to any of our tools to be an enjoyable and educational experience for everyone. Contributions go beyond commits in pull requests. We are excited to receive contributions in the form of feature ideas, pull requests, triaging issues, reviewing pull requests, implementations in your own projects, blog posts, talks referencing the project, tweets, and much more.

## Stoplight Community Code of Conduct

The Stoplight Community is dedicated to providing a safe, inclusive, welcoming, and harassment-free space and experience for all community participants, regardless of gender identity and expression, sexual orientation, disability, physical appearance, socioeconomic status, body size, ethnicity, nationality, level of experience, age, religion (or lack thereof), or other identity markers. 

Our Code of Conduct exists because of that dedication, and we do not tolerate harassment in any form. See our reporting guidelines [here](https://github.com/stoplightio/code-of-conduct/blob/master/incident-reporting.md). Our full Code of Conduct can be found at this [link](https://github.com/stoplightio/code-of-conduct/blob/master/long-form-code-of-conduct.md#long-form-code-of-conduct).

## Development

Yarn is a package manager for your code, similar to npm. While you can use npm to use json-ref-resolver in your own project, we use yarn for development.

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/) it to your computer.
2. Install yarn: `npm install -g yarn`
3. Install deps: `yarn`.
4. Make your changes.
5. Run tests: `yarn test.prod`.
6. Stage relevant files to git.
7. Commit: `yarn commit`. _NOTE: Commits that don't follow the [conventional](https://github.com/marionebl/commitlint/tree/master/%40commitlint/config-conventional) format will be rejected. `yarn commit` creates this format for you, or you can put it together manually and then do a regular `git commit`._
8. Push: `git push`.
9. Open PR targeting the `master` branch.

If this is your first Pull Request on GitHub, here's some [help](https://egghead.io/lessons/javascript-how-to-create-a-pull-request-on-github). 

> We try to respond to all pull requests and issues within 7 days. We welcome feedback from everyone involved in the project in open pull requests. 

If you spot any problems, file an [issue on GitHub](https://github.com/stoplightio/json-ref-resolver/issues).
