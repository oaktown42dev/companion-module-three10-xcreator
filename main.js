import http from 'node:http'

const defaultLogger = (source, level, message) => {
	console.log(`[${level.toUpperCase()}]${source ? ` [${source}]` : ''} ${message}`)
}

function logMessage(source, level, message) {
	const fn = typeof global.COMPANION_LOGGER === 'function' ? global.COMPANION_LOGGER : defaultLogger
	fn(source, level, message)
}

function createLogger(source) {
	return {
		debug: (msg) => logMessage(source, 'debug', msg),
		info: (msg) => logMessage(source, 'info', msg),
		warn: (msg) => logMessage(source, 'warn', msg),
		error: (msg) => logMessage(source, 'error', msg),
	}
}

export function combineRgb(r, g, b, a) {
	let color = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
	if (a && a >= 0 && a < 1) {
		color += 0x1000000 * Math.round(255 * (1 - a))
	}
	return color
}

const InstanceStatus = {
	Ok: 'ok',
	Connecting: 'connecting',
	Disconnected: 'disconnected',
	ConnectionFailure: 'connection_failure',
	BadConfig: 'bad_config',
	UnknownError: 'unknown_error',
	UnknownWarning: 'unknown_warning',
	AuthenticationFailure: 'authentication_failure',
	InsufficientPermissions: 'insufficient_permissions',
}

function isInstanceContext(obj) {
	return !!obj && typeof obj === 'object' && typeof obj.id === 'string' && obj._isInstanceContext === true
}

class InstanceBase {
	#context
	#logger
	#options

	get id() {
		return this.#context.id
	}
	get instanceOptions() {
		return this.#options
	}
	get label() {
		return this.#context.label
	}

	constructor(internal) {
		if (!isInstanceContext(internal) || !internal._isInstanceContext) {
			throw new Error("Module instance is being constructed incorrectly. Make sure you aren't trying to do this manually")
		}
		this.#context = internal
		this.#logger = createLogger()
		this.#options = {
			disableVariableValidation: false,
			disableNewConfigLayout: false,
		}
		this.log('debug', 'Initializing three10-xcreator')
	}

	saveConfig(newConfig, newSecrets) {
		this.#context.saveConfig(newConfig, newSecrets)
	}
	setActionDefinitions(actions) {
		this.#context.setActionDefinitions(actions)
	}
	setFeedbackDefinitions(feedbacks) {
		this.#context.setFeedbackDefinitions(feedbacks)
	}
	setPresetDefinitions(presets, currentValues) {
		this.#context.setPresetDefinitions(presets, currentValues)
	}
	setVariableDefinitions(variables) {
		this.#context.setVariableDefinitions(variables)
	}
	setVariableValues(values) {
		this.#context.setVariableValues(values)
	}
	getVariableValue(variableId) {
		return this.#context.getVariableValue(variableId)
	}
	checkAllFeedbacks() {
		this.#context.checkAllFeedbacks()
	}
	checkFeedbacks(...feedbackTypes) {
		this.#context.checkFeedbacks(feedbackTypes)
	}
	checkFeedbacksById(...feedbackIds) {
		this.#context.checkFeedbacksById(feedbackIds)
	}
	updateStatus(status, message) {
		this.#context.updateStatus(status, message ?? null)
	}
	log(level, message) {
		switch (level) {
			case 'debug':
				this.#logger.debug(message)
				break
			case 'info':
				this.#logger.info(message)
				break
			case 'warn':
				this.#logger.warn(message)
				break
			case 'error':
				this.#logger.error(message)
				break
			default:
				this.#logger.info(message)
				break
		}
	}
}

const MAX_SLIDE_SLOTS = 24
const MAX_EXP_SLOTS = 8

// Initial fallback state from your X-Creator (FKTG) so buttons are immediately populated even while offline!
const INITIAL_EXPERIENCES = [{ name: 'FKTG', id: '6af1af3ef2e1db0017200139', isFavorite: false }]
const INITIAL_SLIDES = [
	{ name: 'Standard', id: '6af1d4f9b7e9215cfc67f681', isFavorite: false },
	{ name: 'Agenda Dienstag', id: '6af1f052b7e9217d3011b6a2', isFavorite: false },
	{ name: 'Agenda Mittwoch', id: '6af1f0e2b7e9217d3011b6a7', isFavorite: false },
	{ name: 'Agenda Donnerstag', id: '6af1f0edb7e9217d3011b6a9', isFavorite: false },
	{ name: 'Agenda Dienstag (2)', id: '6af1f17bb7e9217d3011b6b2', isFavorite: false },
	{ name: 'A Ankündigung', id: '6af1c8e8b7e9212254e9f880', isFavorite: false },
	{ name: 'A prestage', id: '6af1d13cb7e9215cfc67f678', isFavorite: false },
	{ name: 'A show', id: '6af1d1f0b7e9215cfc67f67b', isFavorite: false },
	{ name: 'B Ankündigung', id: '6af1f1c2b7e9217d3011b6b3', isFavorite: false },
	{ name: 'B prestage', id: '6af1f1d8b7e9217d3011b6b4', isFavorite: false },
	{ name: 'B show', id: '6af1f1e4b7e9217d3011b6b5', isFavorite: false },
	{ name: 'Standard (1)', id: '6af1d678b7e9215cfc67f685', isFavorite: false },
]

class XCreatorInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.config = {}
		this.pollTimer = null
		this.isPolling = false
		this.state = {
			online: false,
			experiences: [...INITIAL_EXPERIENCES],
			currentExperience: INITIAL_EXPERIENCES[0],
			slides: [...INITIAL_SLIDES],
			currentSlide: null,
			currentSlideIndex: 0,
		}
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'Steuert <b>three10 X-Creator</b> über die REST API (Standard-Port: 9696) und synchronisiert automatisch alle Experiences, Slides und den aktiven Status auf das Stream Deck.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'X-Creator IP / Hostname',
				width: 6,
				default: '10.10.10.122',
			},
			{
				type: 'number',
				id: 'port',
				label: 'REST API Port',
				width: 3,
				default: 9696,
				min: 1,
				max: 65535,
			},
			{
				type: 'number',
				id: 'pollInterval',
				label: 'Auto-Update Intervall (ms)',
				width: 3,
				default: 1500,
				min: 500,
				max: 60000,
			},
			{
				type: 'textinput',
				id: 'token',
				label: 'Bearer Token (optional, leer lassen falls keine Auth aktiv)',
				width: 12,
				default: '',
			},
		]
	}

	async init(config) {
		await this.configUpdated(config)
	}

	async configUpdated(config) {
		this.config = config || {}
		this.stopPolling()
		this.initVariables()
		this.initActions()
		this.initFeedbacks()
		this.updateStatus(InstanceStatus.Connecting)
		await this.pollNow()
		this.startPolling()
	}

	async destroy() {
		this.stopPolling()
	}

	startPolling() {
		this.stopPolling()
		const interval = Math.max(500, Number(this.config.pollInterval) || 1500)
		this.pollTimer = setInterval(() => {
			this.pollNow().catch(() => null)
		}, interval)
	}

	stopPolling() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
	}

	apiGet(endpoint) {
		return new Promise((resolve, reject) => {
			const host = (this.config.host || '10.10.10.122').trim()
			const port = Number(this.config.port) || 9696
			const headers = {
				Accept: 'application/json',
				Connection: 'close',
			}
			if (this.config.token && this.config.token.trim().length > 0) {
				headers['Authorization'] = `Bearer ${this.config.token.trim()}`
			}

			const req = http.request(
				{
					hostname: host,
					port: port,
					path: `/api/v1${endpoint}`,
					method: 'GET',
					headers: headers,
					agent: false,
					timeout: 2000,
					insecureHTTPParser: true,
				},
				(res) => {
					const chunks = []
					res.on('data', (chunk) => chunks.push(chunk))
					res.on('end', () => {
						const raw = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '').trim()
						let json = null
						if (raw.length > 0) {
							try {
								json = JSON.parse(raw)
							} catch {
								json = raw
							}
						}
						resolve({ statusCode: res.statusCode || 0, data: json, raw })
					})
				}
			)

			req.on('timeout', () => {
				req.destroy(new Error('Request timed out'))
			})
			req.on('error', (err) => {
				reject(err)
			})
			req.end()
		})
	}

	async pollNow() {
		if (this.isPolling) return
		this.isPolling = true
		try {
			const aliveRes = await this.apiGet('/alive')
			if (aliveRes.statusCode !== 200) {
				throw new Error(`Alive check returned ${aliveRes.statusCode}`)
			}

			const expListRes = await this.apiGet('/experiences').catch(() => ({ statusCode: 0, data: null }))
			const curExpRes = await this.apiGet('/experiences/current').catch(() => ({ statusCode: 0, data: null }))
			const slidesRes = await this.apiGet('/slides').catch(() => ({ statusCode: 0, data: null }))
			const curSlideRes = await this.apiGet('/slides/current').catch(() => ({ statusCode: 0, data: null }))

			const wasOnline = this.state.online
			this.state.online = true
			if (!wasOnline) {
				this.updateStatus(InstanceStatus.Ok)
			}

			if (expListRes.statusCode === 200 && Array.isArray(expListRes.data)) {
				this.state.experiences = expListRes.data
			}
			this.state.currentExperience =
				curExpRes.statusCode === 200 && curExpRes.data && typeof curExpRes.data === 'object' ? curExpRes.data : null
			if (slidesRes.statusCode === 200 && Array.isArray(slidesRes.data)) {
				this.state.slides = slidesRes.data
			} else if (!this.state.currentExperience) {
				this.state.slides = []
			}
			this.state.currentSlide =
				curSlideRes.statusCode === 200 && curSlideRes.data && typeof curSlideRes.data === 'object'
					? curSlideRes.data
					: null

			let curIdx = 0
			if (this.state.currentSlide && this.state.currentSlide.id) {
				const found = this.state.slides.findIndex((s) => s.id === this.state.currentSlide.id)
				if (found >= 0) curIdx = found + 1
			}
			this.state.currentSlideIndex = curIdx

			this.updateVariablesAndFeedbacks()
		} catch (err) {
			if (this.state.online) {
				this.log('warn', `X-Creator connection lost: ${err.message}`)
			}
			this.state.online = false
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.updateVariablesAndFeedbacks()
		} finally {
			this.isPolling = false
		}
	}

	initVariables() {
		const vars = {
			status: { name: 'Connection Status (ONLINE / OFFLINE)' },
			current_experience_name: { name: 'Current Experience Name' },
			current_experience_id: { name: 'Current Experience ID' },
			current_slide_name: { name: 'Current Slide Name' },
			current_slide_id: { name: 'Current Slide ID' },
			current_slide_index: { name: 'Current Slide Number (1-based)' },
			slide_count: { name: 'Total Slides in Current Experience' },
			experience_count: { name: 'Total Available Experiences' },
		}

		for (let i = 1; i <= MAX_SLIDE_SLOTS; i++) {
			vars[`slide_${i}_name`] = { name: `Slide Slot ${i} Name` }
			vars[`slide_${i}_label`] = { name: `Slide Slot ${i} Button Label` }
			vars[`slide_${i}_id`] = { name: `Slide Slot ${i} ID` }
		}

		for (let i = 1; i <= MAX_EXP_SLOTS; i++) {
			vars[`exp_${i}_name`] = { name: `Experience Slot ${i} Name` }
			vars[`exp_${i}_id`] = { name: `Experience Slot ${i} ID` }
		}

		this.setVariableDefinitions(vars)
		this.updateVariablesAndFeedbacks()
	}

	updateVariablesAndFeedbacks() {
		const values = {
			status: this.state.online ? 'ONLINE' : 'OFFLINE',
			current_experience_name: this.state.currentExperience?.name || 'Keine Exp.',
			current_experience_id: this.state.currentExperience?.id || '',
			current_slide_name: this.state.currentSlide?.name || '-',
			current_slide_id: this.state.currentSlide?.id || '',
			current_slide_index: this.state.currentSlideIndex > 0 ? String(this.state.currentSlideIndex) : '-',
			slide_count: String(this.state.slides.length),
			experience_count: String(this.state.experiences.length),
		}

		for (let i = 1; i <= MAX_SLIDE_SLOTS; i++) {
			const slide = this.state.slides[i - 1]
			if (slide) {
				values[`slide_${i}_name`] = slide.name || `Slide ${i}`
				values[`slide_${i}_label`] = `${i}: ${slide.name}`
				values[`slide_${i}_id`] = slide.id || ''
			} else {
				values[`slide_${i}_name`] = ''
				values[`slide_${i}_label`] = `Slot ${i}\n-`
				values[`slide_${i}_id`] = ''
			}
		}

		for (let i = 1; i <= MAX_EXP_SLOTS; i++) {
			const exp = this.state.experiences[i - 1]
			if (exp) {
				values[`exp_${i}_name`] = exp.name || `Exp ${i}`
				values[`exp_${i}_id`] = exp.id || ''
			} else {
				values[`exp_${i}_name`] = `Exp ${i} -`
				values[`exp_${i}_id`] = ''
			}
		}

		this.setVariableValues(values)
		this.checkAllFeedbacks()
	}

	initActions() {
		const slotChoices = []
		for (let i = 1; i <= MAX_SLIDE_SLOTS; i++) {
			slotChoices.push({ id: i, label: `Slide Slot ${i}` })
		}

		const expChoices = []
		for (let i = 1; i <= MAX_EXP_SLOTS; i++) {
			expChoices.push({ id: i, label: `Experience Slot ${i}` })
		}

		this.setActionDefinitions({
			next_slide: {
				name: 'Next Slide',
				options: [],
				callback: async () => {
					await this.apiGet('/slides/next').catch((e) => this.log('error', `Next slide failed: ${e.message}`))
					setTimeout(() => this.pollNow().catch(() => null), 100)
				},
			},
			prev_slide: {
				name: 'Previous Slide',
				options: [],
				callback: async () => {
					await this.apiGet('/slides/previous').catch((e) => this.log('error', `Previous slide failed: ${e.message}`))
					setTimeout(() => this.pollNow().catch(() => null), 100)
				},
			},
			load_slide_slot: {
				name: 'Load Slide by Slot (1–24, Auto-Sync)',
				options: [
					{
						type: 'dropdown',
						id: 'slot',
						label: 'Slide Slot (1–24)',
						default: 1,
						choices: slotChoices,
					},
				],
				callback: async (action) => {
					const slot = Number(action.options.slot) || 1
					const slide = this.state.slides[slot - 1]
					if (!slide || !slide.id) {
						this.log('warn', `Slide Slot ${slot} is empty, nothing to load`)
						return
					}
					await this.apiGet(`/slides/${slide.id}`).catch((e) =>
						this.log('error', `Load slide slot ${slot} failed: ${e.message}`)
					)
					this.state.currentSlide = slide
					this.state.currentSlideIndex = slot
					this.updateVariablesAndFeedbacks()
					setTimeout(() => this.pollNow().catch(() => null), 150)
				},
			},
			load_slide_id: {
				name: 'Load Slide by ID',
				options: [
					{
						type: 'textinput',
						id: 'slideId',
						label: 'Slide ID',
						default: '',
						useVariables: true,
					},
				],
				callback: async (action) => {
					const slideId = String(action.options.slideId || '').trim()
					if (!slideId) return
					await this.apiGet(`/slides/${slideId}`).catch((e) =>
						this.log('error', `Load slide ${slideId} failed: ${e.message}`)
					)
					setTimeout(() => this.pollNow().catch(() => null), 150)
				},
			},
			load_experience_slot: {
				name: 'Load Experience by Slot (1–8, Auto-Sync)',
				options: [
					{
						type: 'dropdown',
						id: 'slot',
						label: 'Experience Slot (1–8)',
						default: 1,
						choices: expChoices,
					},
				],
				callback: async (action) => {
					const slot = Number(action.options.slot) || 1
					const exp = this.state.experiences[slot - 1]
					if (!exp || !exp.id) {
						this.log('warn', `Experience Slot ${slot} is empty`)
						return
					}
					await this.apiGet(`/experiences/${exp.id}`).catch((e) =>
						this.log('error', `Load experience slot ${slot} failed: ${e.message}`)
					)
					setTimeout(() => this.pollNow().catch(() => null), 300)
				},
			},
			load_experience_id: {
				name: 'Load Experience by ID',
				options: [
					{
						type: 'textinput',
						id: 'expId',
						label: 'Experience ID',
						default: '6af1af3ef2e1db0017200139',
						useVariables: true,
					},
				],
				callback: async (action) => {
					const expId = String(action.options.expId || '').trim()
					if (!expId) return
					await this.apiGet(`/experiences/${expId}`).catch((e) =>
						this.log('error', `Load experience ${expId} failed: ${e.message}`)
					)
					setTimeout(() => this.pollNow().catch(() => null), 300)
				},
			},
			exit_experience: {
				name: 'Exit Current Experience',
				options: [],
				callback: async () => {
					await this.apiGet('/experiences/exit').catch((e) =>
						this.log('error', `Exit experience failed: ${e.message}`)
					)
					setTimeout(() => this.pollNow().catch(() => null), 200)
				},
			},
			refresh: {
				name: 'Refresh X-Creator State Now',
				options: [],
				callback: async () => {
					await this.pollNow()
				},
			},
		})
	}

	initFeedbacks() {
		const slotChoices = []
		for (let i = 1; i <= MAX_SLIDE_SLOTS; i++) {
			slotChoices.push({ id: i, label: `Slide Slot ${i}` })
		}

		const expChoices = []
		for (let i = 1; i <= MAX_EXP_SLOTS; i++) {
			expChoices.push({ id: i, label: `Experience Slot ${i}` })
		}

		this.setFeedbackDefinitions({
			slide_slot_active: {
				type: 'boolean',
				name: 'Slide Slot is Currently Active (Tally)',
				description: 'Lights up when the Slide in this Slot (1–24) is currently active in X-Creator',
				defaultStyle: {
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 180, 70),
				},
				options: [
					{
						type: 'dropdown',
						id: 'slot',
						label: 'Slide Slot (1–24)',
						default: 1,
						choices: slotChoices,
					},
				],
				callback: (feedback) => {
					const slot = Number(feedback.options.slot) || 1
					const slide = this.state.slides[slot - 1]
					if (!slide || !slide.id || !this.state.currentSlide?.id) return false
					return slide.id === this.state.currentSlide.id
				},
			},
			slide_slot_empty: {
				type: 'boolean',
				name: 'Slide Slot is Empty (No Slide at this Position)',
				description: 'Dims the button when the current Experience has fewer slides than this slot number',
				defaultStyle: {
					color: combineRgb(90, 90, 90),
					bgcolor: combineRgb(15, 18, 24),
				},
				options: [
					{
						type: 'dropdown',
						id: 'slot',
						label: 'Slide Slot (1–24)',
						default: 1,
						choices: slotChoices,
					},
				],
				callback: (feedback) => {
					const slot = Number(feedback.options.slot) || 1
					return !this.state.slides[slot - 1]
				},
			},
			experience_slot_active: {
				type: 'boolean',
				name: 'Experience Slot is Currently Active',
				description: 'Lights up when the Experience in this Slot (1–8) is currently loaded in X-Creator',
				defaultStyle: {
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(13, 148, 136),
				},
				options: [
					{
						type: 'dropdown',
						id: 'slot',
						label: 'Experience Slot (1–8)',
						default: 1,
						choices: expChoices,
					},
				],
				callback: (feedback) => {
					const slot = Number(feedback.options.slot) || 1
					const exp = this.state.experiences[slot - 1]
					if (!exp || !exp.id || !this.state.currentExperience?.id) return false
					return exp.id === this.state.currentExperience.id
				},
			},
			server_online: {
				type: 'boolean',
				name: 'X-Creator Server is Online',
				defaultStyle: {
					color: combineRgb(58, 255, 136),
					bgcolor: combineRgb(6, 78, 59),
				},
				options: [],
				callback: () => {
					return !!this.state.online
				},
			},
		})
	}
}

export const UpgradeScripts = []
export default XCreatorInstance
