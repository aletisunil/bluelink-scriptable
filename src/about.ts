import { getTable, Div, P, Spacer, quickOptions, OK } from 'lib/scriptable-utils'
import { GithubRelease, Version } from 'lib/version'
import { getAppLogger } from './lib/util'

const SCRIPTABLE_DIR = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents'
const logger = getAppLogger()

export function doDowngrade(appFile = `${Script.name()}.js`) {
  const fm = FileManager.iCloud()
  if (fm.fileExists(`${SCRIPTABLE_DIR}/${appFile}.backup`)) {
    fm.remove(`${SCRIPTABLE_DIR}/${appFile}`)
    fm.move(`${SCRIPTABLE_DIR}/${appFile}.backup`, `${SCRIPTABLE_DIR}/${appFile}`)
  } else {
    OK('Downgrade Dailed', { message: `There is no previous version of ${appFile}` })
  }
}

async function doUpgrade(url: string, appFile = `${Script.name()}.js`) {
  const req = new Request(url)
  const data = await req.load()
  if (req.response.statusCode === 200) {
    const fm = FileManager.iCloud()
    // try to backup current script - log errors, script could have been renamed for example
    try {
      if (fm.fileExists(`${SCRIPTABLE_DIR}/${appFile}.backup`)) {
        fm.remove(`${SCRIPTABLE_DIR}/${appFile}.backup`)
      }
      fm.move(`${SCRIPTABLE_DIR}/${appFile}`, `${SCRIPTABLE_DIR}/${appFile}.backup`)
    } catch (e) {
      logger.log(`Failed to backup current script: ${e}`)
    }
    fm.write(`${SCRIPTABLE_DIR}/${appFile}`, data)
  } else {
    OK('Download Error', { message: `Failed to download release: ${req.response.statusCode}` })
  }
}

const { present, connect, setState } = getTable<{
  release: GithubRelease | undefined
  currentVersion: string
}>({
  name: 'About App',
})

export async function loadAboutScreen() {
  // load version async
  const version = new Version('aletisunil', 'bluelink-scriptable')
  version
    .getRelease()
    .then((release) => setState({ release: release }))
    .catch(() => {})

  return present({
    defaultState: {
      release: undefined,
      currentVersion: version.getCurrentVersion(),
    },
    render: () => [
      pageTitle(),
      appDescription(),
      appWebsite(),
      author(),
      Spacer({ rowHeight: 30 }),
      currentVersion(),
      latestVersion(),
      Spacer(),
      upgrade(),
      upgradeNotes(),
    ],
  })
}

const pageTitle = connect(() => {
  return Div([
    P('e-GMP Bluelink app', {
      font: (n) => Font.boldSystemFont(n),
      fontSize: 35,
      align: 'left',
    }),
  ])
})

const appDescription = connect(() => {
  return Div(
    [
      P('A scriptable app for IOS that allows you to control your Hyundai / Kia electric car using the Bluelink API.', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        align: 'left',
      }),
    ],
    {
      height: 100,
    },
  )
})

const author = connect(() => {
  const divArray = [
    P("Maintainer: Sunil Aleti (fork of Andy Fase's app)", {
      font: (n) => Font.mediumRoundedSystemFont(n),
      fontSize: 20,
      align: 'left',
    }),
  ]
  return Div(divArray, {
    height: 60,
    align: 'center',
    onTap: () => Safari.open('https://github.com/aletisunil/bluelink-scriptable'),
  })
})

const currentVersion = connect(({ state: { currentVersion } }) => {
  return Div([
    P(`Current Version:`, {
      font: (n) => Font.mediumRoundedSystemFont(n),
      fontSize: 20,
      align: 'left',
    }),
    P(currentVersion, {
      font: (n) => Font.boldRoundedSystemFont(n),
      fontSize: 20,
      align: 'right',
    }),
  ])
})

const latestVersion = connect(({ state: { currentVersion, release } }) => {
  if (!release) return Spacer()

  return Div([
    P(`Latest Version Available:`, {
      font: (n) => Font.mediumRoundedSystemFont(n),
      fontSize: 20,
      align: 'left',
      width: '80%',
    }),
    P(release.version, {
      font: (n) => Font.boldRoundedSystemFont(n),
      fontSize: 20,
      align: 'right',
      color:
        Version.versionToNumber(currentVersion) >= Version.versionToNumber(release.version)
          ? Color.green()
          : Color.blue(),
    }),
  ])
})

const upgrade = connect(({ state: { currentVersion, release } }) => {
  if (!release || Version.versionToNumber(currentVersion) >= Version.versionToNumber(release.version)) return Spacer()

  return Div(
    [
      P(`Click to Auto Install ${release.version}`, {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'center',
      }),
    ],
    {
      onTap: async () => {
        const appFile = `${Script.name()}.js`
        quickOptions(['Install', 'Cancel'], {
          title: `Confirm Install - App will update "${appFile}" and auto-close`,
          onOptionSelect: async (opt) => {
            if (opt === 'Install') {
              await doUpgrade(release.url, appFile)
              Script.complete()
              // @ts-ignore - undocumented api
              App.close()
            }
          },
        })
      },
    },
  )
})

const upgradeNotes = connect(({ state: { currentVersion, release } }) => {
  if (!release || Version.versionToNumber(currentVersion) >= Version.versionToNumber(release.version)) return Spacer()

  return Div(
    [
      P(`Release Details:\n\n ${release.name}:\n\n ${release.notes}`, {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 17,
        align: 'left',
      }),
    ],
    { height: 300 },
  )
})

const appWebsite = connect(() => {
  return Div(
    [
      P('https://github.com/aletisunil/bluelink-scriptable', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'left',
      }),
    ],
    {
      onTap: async () => {
        Safari.open('https://github.com/aletisunil/bluelink-scriptable')
      },
    },
  )
})
