import * as core from '@actions/core'
import { FILE } from 'dns'
import { GitHubDownloader, GitHubOptions } from './downloader'

export async function run(): Promise<void> {
  try {
    const GH_TOKEN: string = core.getInput('GH_TOKEN')
    const REPOSITORY: string = core.getInput('repository')
    const ORGANIZATION: string = core.getInput('organization')
    const SHA: string = core.getInput('sha')
    const INPUT_PATH: string = core.getInput('input_path')
    const OUTPUT_PATH: string = core.getInput('output_path')
    const FILES: string[] = core.getInput('files').split(',')
    const EXTENSIONS: string[] = core.getInput('extensions').split(',')

    const downloader: GitHubDownloader = new GitHubDownloader({
      GH_TOKEN: GH_TOKEN,
      repository: {
        repository: REPOSITORY,
        organization: ORGANIZATION,
        sha: SHA || undefined
      },
      input_path: INPUT_PATH,
      output_path: OUTPUT_PATH || undefined,
      filter: {
        files: FILES || undefined,
        extensions: EXTENSIONS || undefined
      }
    })

    core.debug(`Starting to download files from ${ORGANIZATION}/${REPOSITORY}`)

    await downloader.downloadFolder()

    core.debug('Done downloading files')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
