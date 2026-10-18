import { promises as fs } from 'node:fs'
import { isActiveType, projectSchema, templateSchema, workspaceSchema, type DocumentRecord, type WorkspaceConfig, type WorkspaceResponse } from '../../../../packages/schemas/src/index'
import { AppError, SerialQueue, atomicWrite, checksum, exists, safePath } from './filesystem'
import { validateBody } from './markdown'

export class WorkspaceStore {
  private queue = new SerialQueue()
  constructor(private root: string) {}
  private file() { return safePath(this.root, '.knowledge-state/workspace.json') }
  async init(docs: DocumentRecord[]) {
    const file = await this.file()
    if (await exists(file)) return
    const config: WorkspaceConfig = { version: 1, name: 'Atlas Knowledge Hub', templates: [], projects: [...new Set(docs.map(d => d.metadata.project_id))].map(id => ({
      id, name: id === 'demo-project' ? 'Demo Workflow System' : id, description: '', demo: id === 'demo-project',
      // Preserve the publishing policy of existing repositories. New projects require review.
      require_review: false, modules: [...new Set(docs.filter(d => d.metadata.project_id === id).map(d => d.metadata.module))].map(id => ({ id, name: id }))
    })) }
    await atomicWrite(file, JSON.stringify(config, null, 2))
  }
  async read(): Promise<WorkspaceResponse> {
    const raw = await fs.readFile(await this.file(), 'utf8')
    return { ...workspaceSchema.parse(JSON.parse(raw)), revision: checksum(raw) }
  }
  async update(input: unknown, revision: string) {
    return this.queue.run(async () => {
      const current = await this.read()
      if (current.revision !== revision) throw new AppError(409, 'Cấu hình đã thay đổi. Tải lại trước khi lưu.')
      const config = workspaceSchema.parse(input)
      if (new Set(config.projects.map(p => p.id)).size !== config.projects.length) throw new AppError(400, 'Project ID bị trùng.')
      for (const project of current.projects) if (!config.projects.some(p => p.id === project.id)) throw new AppError(400, 'Không được xóa project hiện có; tài liệu và lịch sử vẫn tham chiếu project này.')
      for (const project of config.projects) {
        if (new Set(project.modules.map(m => m.id)).size !== project.modules.length) throw new AppError(400, 'Module ID bị trùng.')
        const previous = current.projects.find(p => p.id === project.id)
        if (previous?.modules.some(m => !project.modules.some(next => next.id === m.id))) throw new AppError(400, 'Không được xóa module đã đăng ký. Có thể đổi tên hiển thị.')
        projectSchema.parse(project)
      }
      if (new Set(config.templates.map(t => t.id)).size !== config.templates.length) throw new AppError(400, 'Template ID bị trùng.')
      for (const item of config.templates) {
        templateSchema.parse(item); validateBody(item.body)
        if (item.project_id && !config.projects.some(p => p.id === item.project_id)) throw new AppError(400, 'Project của template chưa tồn tại.')
        const previous = current.templates.find(t => t.id === item.id)
        if (!isActiveType(item.type) && JSON.stringify(item) !== JSON.stringify(previous)) throw new AppError(400, 'Template kiểm thử chỉ được lưu trữ, không tạo hoặc chỉnh sửa mới.')
        if (previous && previous.body !== item.body) item.version = previous.version + 1
        else if (previous) item.version = previous.version
      }
      await atomicWrite(await this.file(), JSON.stringify(config, null, 2))
      return this.read()
    })
  }
  async validateLocation(projectId: string, moduleId: string) {
    const project = (await this.read()).projects.find(p => p.id === projectId)
    if (!project) throw new AppError(400, 'Project chưa tồn tại. Tạo project trong Cấu hình không gian.')
    if (!project.modules.some(m => m.id === moduleId)) throw new AppError(400, 'Module chưa được đăng ký cho project này.')
    return project
  }
}
