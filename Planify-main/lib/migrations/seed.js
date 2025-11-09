require('dotenv').config()
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

async function seed() {
  const client = await pool.connect()
  
  try {
    console.log('🌱 Starting database seeding...\n')

    await client.query('BEGIN')

    // Clear existing data (in reverse order of dependencies)
    console.log('🗑️  Clearing existing data...')
    await client.query('TRUNCATE TABLE event_queries, event_attendees, tasks, events, club_members, clubs, community_members, communities, permissions, users RESTART IDENTITY CASCADE')
    console.log('✅ Data cleared\n')

    // 1. Create Users
    console.log('👥 Creating users...')
    const hashedAdminPass = await bcrypt.hash('mnbvcxzlkA123', 10)
    const hashedUserPass = await bcrypt.hash('password123', 10)

    const adminResult = await client.query(`
      INSERT INTO users (name, email, password, role, image, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, name, email, role
    `, ['Jayesh Wani', 'wanijayesh02@gmail.com', hashedAdminPass, 'community_admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'])

    const admin = adminResult.rows[0]
    console.log(`✅ Admin created: ${admin.name} (${admin.email}) - Role: ${admin.role}`)

    // Create regular users
    const users = []
    const userNames = [
      { name: 'Alice Johnson', email: 'alice@example.com' },
      { name: 'Bob Smith', email: 'bob@example.com' },
      { name: 'Charlie Brown', email: 'charlie@example.com' },
      { name: 'Diana Prince', email: 'diana@example.com' },
      { name: 'Eve Wilson', email: 'eve@example.com' }
    ]

    for (const userData of userNames) {
      const result = await client.query(`
        INSERT INTO users (name, email, password, role, image, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, name, email, role
      `, [userData.name, userData.email, hashedUserPass, 'audience', `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`])
      users.push(result.rows[0])
      console.log(`✅ User created: ${result.rows[0].name} (${result.rows[0].email})`)
    }
    console.log('')

    // 2. Create Communities
    console.log('🏘️  Creating communities...')
    const communityResult = await client.query(`
      INSERT INTO communities (name, description, invite_code, admin_id, created_at, updated_at)
      VALUES 
        ($1, $2, $3, $4, NOW(), NOW()),
        ($5, $6, $7, $4, NOW(), NOW())
      RETURNING id, name, admin_id
    `, [
      'Tech Innovators Community',
      'A community for technology enthusiasts, developers, and innovators to collaborate and learn together.',
      'TECH2024',
      admin.id,
      'Creative Arts Hub',
      'Bringing together artists, designers, and creative minds to showcase and develop their talents.',
      'ARTS2024'
    ])

    const communities = communityResult.rows
    console.log(`✅ Created ${communities.length} communities`)
    console.log('')

    // 3. Add Community Members
    console.log('👤 Adding community members...')
    for (const community of communities) {
      // Admin is automatically a member
      await client.query(`
        INSERT INTO community_members (community_id, user_id, role, joined_at)
        VALUES ($1, $2, $3, NOW())
      `, [community.id, admin.id, 'admin'])

      // Add some regular users as members
      for (let i = 0; i < 3; i++) {
        const user = users[i % users.length]
        await client.query(`
          INSERT INTO community_members (community_id, user_id, role, joined_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT DO NOTHING
        `, [community.id, user.id, 'member'])
      }
    }
    console.log(`✅ Community members added\n`)

    // 4. Create Clubs
    console.log('🎯 Creating clubs...')
    const clubsData = [
      { name: 'AI & Machine Learning', desc: 'Exploring artificial intelligence and machine learning technologies', communityId: communities[0].id },
      { name: 'Web Development', desc: 'Building modern web applications and learning new frameworks', communityId: communities[0].id },
      { name: 'Digital Art', desc: 'Creating digital artwork and learning design tools', communityId: communities[1].id },
      { name: 'Photography', desc: 'Capturing moments and mastering photography techniques', communityId: communities[1].id }
    ]

    const clubs = []
    for (const clubData of clubsData) {
      const result = await client.query(`
        INSERT INTO clubs (name, description, community_id, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id, name, community_id
      `, [clubData.name, clubData.desc, clubData.communityId])
      clubs.push(result.rows[0])
      console.log(`✅ Club created: ${result.rows[0].name}`)
    }
    console.log('')

    // 5. Add Club Members
    console.log('👥 Adding club members...')
    for (const club of clubs) {
      // Add admin as club lead
      await client.query(`
        INSERT INTO club_members (club_id, user_id, role, joined_at)
        VALUES ($1, $2, $3, NOW())
      `, [club.id, admin.id, 'lead'])

      // Add 2-3 users to each club
      for (let i = 0; i < 3; i++) {
        const user = users[i]
        await client.query(`
          INSERT INTO club_members (club_id, user_id, role, joined_at)
          VALUES ($1, $2, $3, NOW())
        `, [club.id, user.id, 'member'])
      }
    }
    console.log(`✅ Club members added\n`)

    // 6. Create Events
    console.log('📅 Creating events...')
    const eventsData = [
      {
        title: 'AI Workshop: Building Your First Neural Network',
        desc: 'Hands-on workshop on creating neural networks using Python and TensorFlow',
        date: new Date('2025-12-15T14:00:00'),
        endDate: new Date('2025-12-15T17:00:00'),
        location: 'Tech Hub - Room 101',
        maxAttendees: 30,
        clubId: clubs[0].id,
        communityId: communities[0].id
      },
      {
        title: 'React & Next.js Bootcamp',
        desc: 'Learn modern web development with React and Next.js framework',
        date: new Date('2025-12-20T10:00:00'),
        endDate: new Date('2025-12-20T16:00:00'),
        location: 'Online - Zoom',
        maxAttendees: 50,
        clubId: clubs[1].id,
        communityId: communities[0].id
      },
      {
        title: 'Digital Art Exhibition',
        desc: 'Showcase your digital artwork and get feedback from professionals',
        date: new Date('2025-12-18T18:00:00'),
        endDate: new Date('2025-12-18T21:00:00'),
        location: 'Art Gallery - Main Hall',
        maxAttendees: 100,
        clubId: clubs[2].id,
        communityId: communities[1].id
      },
      {
        title: 'Photography Walk: Urban Landscapes',
        desc: 'Group photography session exploring urban architecture and street photography',
        date: new Date('2025-12-22T08:00:00'),
        endDate: new Date('2025-12-22T12:00:00'),
        location: 'City Center - Meet at Fountain Square',
        maxAttendees: 20,
        clubId: clubs[3].id,
        communityId: communities[1].id
      }
    ]

    const events = []
    for (const eventData of eventsData) {
      const result = await client.query(`
        INSERT INTO events (title, description, date, end_date, location, max_attendees, club_id, community_id, organizer_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id, title
      `, [
        eventData.title,
        eventData.desc,
        eventData.date,
        eventData.endDate,
        eventData.location,
        eventData.maxAttendees,
        eventData.clubId,
        eventData.communityId,
        admin.id
      ])
      events.push(result.rows[0])
      console.log(`✅ Event created: ${result.rows[0].title}`)
    }
    console.log('')

    // 7. Add Event Attendees
    console.log('🎟️  Adding event attendees...')
    for (const event of events) {
      // Add 3-5 attendees per event
      for (let i = 0; i < 4; i++) {
        const user = users[i]
        await client.query(`
          INSERT INTO event_attendees (event_id, user_id, name, email, registered_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [event.id, user.id, user.name, user.email])
      }
    }
    console.log(`✅ Event attendees added\n`)

    // 8. Create Tasks
    console.log('✅ Creating tasks...')
    const tasksData = [
      {
        title: 'Prepare workshop materials',
        desc: 'Create presentation slides and code examples for the AI workshop',
        status: 'in_progress',
        priority: 'high',
        dueDate: new Date('2025-12-10'),
        clubId: clubs[0].id,
        eventId: events[0].id,
        assignedTo: users[0].id
      },
      {
        title: 'Set up Zoom meeting',
        desc: 'Configure Zoom room and send invitations to all registered participants',
        status: 'pending',
        priority: 'medium',
        dueDate: new Date('2025-12-18'),
        clubId: clubs[1].id,
        eventId: events[1].id,
        assignedTo: users[1].id
      },
      {
        title: 'Arrange art display equipment',
        desc: 'Set up projectors, screens, and lighting for the exhibition',
        status: 'pending',
        priority: 'high',
        dueDate: new Date('2025-12-17'),
        clubId: clubs[2].id,
        eventId: events[2].id,
        assignedTo: users[2].id
      }
    ]

    for (const taskData of tasksData) {
      await client.query(`
        INSERT INTO tasks (title, description, status, priority, due_date, club_id, event_id, assigned_to, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        taskData.title,
        taskData.desc,
        taskData.status,
        taskData.priority,
        taskData.dueDate,
        taskData.clubId,
        taskData.eventId,
        taskData.assignedTo,
        admin.id
      ])
    }
    console.log(`✅ Created ${tasksData.length} tasks\n`)

    // 9. Add Event Queries
    console.log('💬 Adding event queries...')
    await client.query(`
      INSERT INTO event_queries (event_id, user_id, user_name, user_image, question, answer, answered_at, created_at)
      VALUES 
        ($1, $2, $3, $4, $5, $6, NOW(), NOW()),
        ($7, $8, $9, $10, $11, NULL, NULL, NOW())
    `, [
      events[0].id, users[0].id, users[0].name, users[0].image,
      'What prerequisites do I need for this workshop?',
      'Basic Python knowledge and a laptop with Python 3.8+ installed.',
      events[1].id, users[1].id, users[1].name, users[1].image,
      'Will this bootcamp cover TypeScript as well?'
    ])
    console.log(`✅ Event queries added\n`)

    // 10. Set up Permissions
    console.log('🔐 Setting up permissions...')
    const permissions = [
      // Community Admin permissions
      { role: 'community_admin', resource: 'communities', action: 'create' },
      { role: 'community_admin', resource: 'communities', action: 'update' },
      { role: 'community_admin', resource: 'communities', action: 'delete' },
      { role: 'community_admin', resource: 'clubs', action: 'create' },
      { role: 'community_admin', resource: 'clubs', action: 'update' },
      { role: 'community_admin', resource: 'clubs', action: 'delete' },
      { role: 'community_admin', resource: 'events', action: 'create' },
      { role: 'community_admin', resource: 'events', action: 'update' },
      { role: 'community_admin', resource: 'events', action: 'delete' },
      { role: 'community_admin', resource: 'tasks', action: 'create' },
      { role: 'community_admin', resource: 'tasks', action: 'update' },
      { role: 'community_admin', resource: 'tasks', action: 'delete' },
      
      // Community Member permissions
      { role: 'community_member', resource: 'clubs', action: 'create' },
      { role: 'community_member', resource: 'clubs', action: 'update' },
      { role: 'community_member', resource: 'events', action: 'create' },
      { role: 'community_member', resource: 'tasks', action: 'create' },
      { role: 'community_member', resource: 'tasks', action: 'update' },
      
      // Audience permissions (view only, no create/update/delete)
      { role: 'audience', resource: 'communities', action: 'view' },
      { role: 'audience', resource: 'clubs', action: 'view' },
      { role: 'audience', resource: 'events', action: 'view' }
    ]

    for (const perm of permissions) {
      await client.query(`
        INSERT INTO permissions (role, resource, action)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [perm.role, perm.resource, perm.action])
    }
    console.log(`✅ Permissions configured\n`)

    await client.query('COMMIT')

    console.log('✅ Database seeding completed successfully!\n')
    console.log('📊 Summary:')
    console.log(`   - Admin User: wanijayesh02@gmail.com (password: mnbvcxzlkA123)`)
    console.log(`   - Regular Users: ${users.length} (password: password123)`)
    console.log(`   - Communities: ${communities.length}`)
    console.log(`   - Clubs: ${clubs.length}`)
    console.log(`   - Events: ${events.length}`)
    console.log(`   - Tasks: ${tasksData.length}`)
    console.log(`   - Permissions: ${permissions.length}\n`)
    console.log('🎉 You can now login with wanijayesh02@gmail.com')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Seeding failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch(console.error)
