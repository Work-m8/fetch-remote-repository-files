import { Octokit, RestEndpointMethodTypes } from '@octokit/rest'

import fs from 'fs'

import { extname } from 'path'
import { promisify } from 'util'
import { dirname, join } from 'path'

const mkdir = promisify(fs.mkdir)
const writeFile = promisify(fs.writeFile)

export interface Repository {
  organization: string
  repository: string
  sha?: string
}

export interface Filter {
  extensions?: string[]
  files?: string[]
}

export interface GitHubOptions {
  GH_TOKEN: string
  repository: Repository
  input_path: string
  filter?: Filter
  output_path?: string
}

export class GitHubDownloader {
  private octokit: Octokit

  constructor(private options: GitHubOptions) {
    this.octokit = new Octokit({
      auth: options.GH_TOKEN
    })
  }

  downloadFolder(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getFileStructure(
        this.options.input_path,
        this.options.repository
      ).then(files => {
        Promise.all(
          files
            .filter(
              node =>
                node.path.startsWith(this.options.input_path) &&
                node.type === 'file'
            )
            .filter(node => {
              return this.options.filter
                ? (
                    this.options.filter.extensions || [extname(node.path)]
                  ).includes(extname(node.path)) &&
                    (this.options.filter.files || [node.path]).includes(
                      node.path
                    )
                : true
            })
            .map(async node =>
              this.getFileContent(this.options.repository, node)
            )
        ).then(files => {
          Promise.all(
            files.map(file => {
              return mkdir(
                dirname(join(this.options.output_path || '', file.path)),
                {
                  recursive: true
                }
              )
                .then(() => {
                  return writeFile(
                    join(this.options.output_path || '', file.path),
                    file.contents
                  )
                })
                .catch(err => reject(err))
            })
          )
            .then(() => resolve())
            .catch(err => reject(err))
        })
      })
    })
  }

  protected async getFileContent(
    repository: Repository,
    node: { sha: string; path: string }
  ): Promise<{ path: string; contents: Buffer }> {
    const { data } = await this.octokit.git.getBlob({
      owner: repository.organization,
      repo: repository.repository,
      file_sha: node.sha
    })

    return {
      path: node.path,
      contents: Buffer.from(data.content)
    }
  }

  protected getFileStructure(
    path: string,
    repository: Repository
  ): Promise<{ path: string; type: string; sha: string }[]> {
    return new Promise((resolve, reject) => {
      const req: RestEndpointMethodTypes['repos']['getContent']['parameters'] =
        {
          owner: repository.organization,
          repo: repository.repository,
          path: path
        }
      this.octokit.repos
        .getContent(req)
        .then(res => {
          const dirs = (res.data as unknown[]).map((node: any) => {
            if (node.type === 'dir') {
              return this.getFileStructure(node.path, repository)
            }
            return {
              path: node.path,
              type: node.type,
              sha: node.sha
            }
          })
          Promise.all(dirs)
            .then(res => resolve(res.flat()))
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }
}
