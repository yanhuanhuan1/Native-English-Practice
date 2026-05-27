import type { Scenario } from "@/types/scenario";

const rawStarterScenarios: Omit<Scenario, "source">[] = [
  {
    id: "daily-001",
    promptZh: "你在朋友家吃饭，觉得菜很好吃，想自然地夸一句。",
    speaker: "你",
    listener: "朋友",
    relationship: "熟悉的朋友",
    mood: "轻松、真诚",
    situation: "朋友刚把自己做的菜端上桌",
    topic: "daily",
    difficulty: "beginner",
    intent: "夸菜好吃",
    referenceAnswers: ["This is so good.", "Wow, this tastes amazing."]
  },
  {
    id: "daily-002",
    promptZh: "朋友问你周末过得怎么样，你其实没干什么，想随口回答。",
    speaker: "你",
    listener: "朋友",
    relationship: "普通朋友",
    mood: "随意",
    situation: "周一见面闲聊",
    topic: "daily",
    difficulty: "beginner",
    intent: "说周末很普通、没什么特别",
    referenceAnswers: [
      "Pretty quiet, honestly.",
      "Not much, just took it easy."
    ]
  },
  {
    id: "daily-003",
    promptZh: "你和室友都快出门了，你想提醒对方别忘了带钥匙。",
    speaker: "你",
    listener: "室友",
    relationship: "同住的朋友",
    mood: "自然提醒",
    situation: "两个人准备出门",
    topic: "daily",
    difficulty: "beginner",
    intent: "提醒带钥匙",
    referenceAnswers: [
      "Don't forget your keys.",
      "Make sure you grab your keys."
    ]
  },
  {
    id: "daily-004",
    promptZh: "朋友说他最近睡得很差，你想表示关心并建议他早点休息。",
    speaker: "你",
    listener: "朋友",
    relationship: "熟悉的朋友",
    mood: "关心",
    situation: "朋友说自己这几天很累",
    topic: "daily",
    difficulty: "intermediate",
    intent: "表达关心并建议休息",
    referenceAnswers: [
      "That sounds rough. You should try to get some rest tonight.",
      "Man, that's not good. Maybe take it easy tonight."
    ]
  },
  {
    id: "daily-005",
    promptZh: "有人在电梯里问你能不能帮忙按 12 楼，你想自然地说可以。",
    speaker: "你",
    listener: "陌生人",
    relationship: "陌生人",
    mood: "礼貌、随手帮忙",
    situation: "电梯里",
    topic: "daily",
    difficulty: "beginner",
    intent: "答应帮忙按楼层",
    referenceAnswers: ["Sure.", "Yeah, no problem."]
  },
  {
    id: "daily-006",
    promptZh: "朋友临时取消见面，你有点失望但想表现得大方。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "理解但有点失望",
    situation: "朋友发消息说今天来不了了",
    topic: "daily",
    difficulty: "intermediate",
    intent: "表示理解并改天再约",
    referenceAnswers: [
      "No worries. Let's do another day.",
      "It's okay, we can catch up another time."
    ]
  },
  {
    id: "workplace-001",
    promptZh: "同事问你今天忙不忙，你挺忙但不想听起来像抱怨。",
    speaker: "你",
    listener: "同事",
    relationship: "普通同事",
    mood: "友好、轻描淡写",
    situation: "办公室早上碰面",
    topic: "workplace",
    difficulty: "beginner",
    intent: "说今天有点忙",
    referenceAnswers: [
      "A little busy, but not too bad.",
      "I've got a few things going on, but it's manageable."
    ]
  },
  {
    id: "workplace-002",
    promptZh: "会议里你没听清对方刚才说的最后一句，想请他再说一遍。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "礼貌、自然",
    situation: "团队会议",
    topic: "workplace",
    difficulty: "beginner",
    intent: "请对方重复",
    referenceAnswers: [
      "Sorry, could you say that last part again?",
      "I missed the last bit. Could you repeat it?"
    ]
  },
  {
    id: "workplace-003",
    promptZh: "老板问一个任务今天能不能完成，你觉得可能不行，想诚实但不生硬地说。",
    speaker: "你",
    listener: "老板",
    relationship: "上下级",
    mood: "专业、坦诚",
    situation: "老板询问进度",
    topic: "workplace",
    difficulty: "intermediate",
    intent: "说明今天可能完不成",
    referenceAnswers: [
      "I might need a bit more time on this.",
      "I don't think I can finish it today, but I can have it ready tomorrow."
    ]
  },
  {
    id: "workplace-004",
    promptZh: "你想在会议里补充一个小点，不想打断得太突兀。",
    speaker: "你",
    listener: "会议成员",
    relationship: "同事",
    mood: "礼貌、有参与感",
    situation: "讨论方案时",
    topic: "workplace",
    difficulty: "intermediate",
    intent: "插入补充观点",
    referenceAnswers: [
      "Can I add one quick thing?",
      "Just to add to that, I think we should also consider timing."
    ]
  },
  {
    id: "workplace-005",
    promptZh: "同事帮你改了一个问题，你想自然地感谢他救了你一把。",
    speaker: "你",
    listener: "同事",
    relationship: "关系不错的同事",
    mood: "感谢、轻松",
    situation: "同事刚帮你修好一个文件问题",
    topic: "workplace",
    difficulty: "beginner",
    intent: "感谢帮忙",
    referenceAnswers: [
      "Thanks, you saved me.",
      "I really appreciate it. That helped a lot."
    ]
  },
  {
    id: "workplace-006",
    promptZh: "你不同意同事的方案，但想先肯定对方再提出担心。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "委婉、合作",
    situation: "方案评审",
    topic: "workplace",
    difficulty: "advanced",
    intent: "委婉表达不同意见",
    referenceAnswers: [
      "I see where you're coming from, but I'm a little worried about the timeline.",
      "That makes sense in some ways. My only concern is whether we can pull it off that quickly."
    ]
  },
  {
    id: "help-001",
    promptZh: "你找不到某个会议室，想问前台怎么走。",
    speaker: "你",
    listener: "前台",
    relationship: "陌生人",
    mood: "礼貌",
    situation: "办公楼大厅",
    topic: "help",
    difficulty: "beginner",
    intent: "问路",
    referenceAnswers: [
      "Hi, could you tell me where meeting room B is?",
      "Excuse me, do you know how to get to meeting room B?"
    ]
  },
  {
    id: "help-002",
    promptZh: "你手里东西太多，想请朋友帮你拿一下门。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "随意",
    situation: "进门时两手都拿着东西",
    topic: "help",
    difficulty: "beginner",
    intent: "请求帮忙扶门",
    referenceAnswers: [
      "Can you get the door for me?",
      "Could you hold the door for a second?"
    ]
  },
  {
    id: "help-003",
    promptZh: "你不确定表格怎么填，想问同事能不能快速看一眼。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "礼貌、不占太多时间",
    situation: "填写内部表格",
    topic: "help",
    difficulty: "intermediate",
    intent: "请对方帮忙确认",
    referenceAnswers: [
      "Could you take a quick look at this for me?",
      "Do you mind checking this real quick?"
    ]
  },
  {
    id: "help-004",
    promptZh: "你手机快没电了，想问咖啡店店员有没有地方可以充电。",
    speaker: "你",
    listener: "店员",
    relationship: "顾客和店员",
    mood: "礼貌、急需",
    situation: "咖啡店里",
    topic: "help",
    difficulty: "beginner",
    intent: "询问充电位置",
    referenceAnswers: [
      "Is there anywhere I can charge my phone?",
      "Do you have an outlet I could use?"
    ]
  },
  {
    id: "help-005",
    promptZh: "你想请朋友帮你搬一个小柜子，但怕麻烦对方。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "不好意思但需要帮忙",
    situation: "搬家前整理房间",
    topic: "help",
    difficulty: "intermediate",
    intent: "委婉请求帮忙搬东西",
    referenceAnswers: [
      "Could you help me move this real quick?",
      "Sorry to bug you, but could you give me a hand with this?"
    ]
  },
  {
    id: "help-006",
    promptZh: "你在国外超市自助结账机卡住了，想叫工作人员帮忙。",
    speaker: "你",
    listener: "超市工作人员",
    relationship: "顾客和工作人员",
    mood: "礼貌、有点尴尬",
    situation: "自助结账机器报错",
    topic: "help",
    difficulty: "intermediate",
    intent: "请求工作人员处理机器问题",
    referenceAnswers: [
      "Excuse me, I think the machine is stuck.",
      "Sorry, could you help me with this? It won't go through."
    ]
  },
  {
    id: "disagreement-001",
    promptZh: "朋友说一部电影特别好看，你觉得一般，想自然地表达不同看法。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "随意、不争辩",
    situation: "聊电影",
    topic: "disagreement",
    difficulty: "beginner",
    intent: "表达自己觉得一般",
    referenceAnswers: [
      "It was okay, but I didn't love it.",
      "I thought it was just alright."
    ]
  },
  {
    id: "disagreement-002",
    promptZh: "朋友想点很辣的菜，但你不能吃辣，想直接但不扫兴地说。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "轻松、诚实",
    situation: "一起点菜",
    topic: "disagreement",
    difficulty: "beginner",
    intent: "表达不能吃辣",
    referenceAnswers: [
      "I'm not great with spicy food.",
      "Could we get something less spicy too?"
    ]
  },
  {
    id: "disagreement-003",
    promptZh: "同事建议今天就上线，你觉得太赶了，想提出反对但保持合作。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "谨慎、合作",
    situation: "上线前讨论",
    topic: "disagreement",
    difficulty: "advanced",
    intent: "反对仓促上线",
    referenceAnswers: [
      "I'm not sure we're ready to launch today.",
      "I'd feel better if we tested it one more time before going live."
    ]
  },
  {
    id: "disagreement-004",
    promptZh: "朋友一直坚持一个你觉得不太现实的计划，你想温和地提醒他。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "委婉、现实",
    situation: "讨论旅行预算",
    topic: "disagreement",
    difficulty: "intermediate",
    intent: "提醒计划可能不现实",
    referenceAnswers: [
      "I get the idea, but that might be a bit hard to pull off.",
      "That sounds fun, but I'm not sure it's realistic."
    ]
  },
  {
    id: "disagreement-005",
    promptZh: "别人误会了你的意思，你想澄清不是在责怪他。",
    speaker: "你",
    listener: "朋友或同事",
    relationship: "熟人",
    mood: "缓和、解释",
    situation: "对方有点防御",
    topic: "disagreement",
    difficulty: "intermediate",
    intent: "说明自己不是责怪",
    referenceAnswers: [
      "I'm not blaming you. I just want to understand what happened.",
      "That's not what I meant. I'm just trying to figure it out."
    ]
  },
  {
    id: "disagreement-006",
    promptZh: "同事的说法你基本同意，但有一个细节你觉得需要改。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "建设性",
    situation: "讨论文案或方案",
    topic: "disagreement",
    difficulty: "intermediate",
    intent: "部分同意并提出小改动",
    referenceAnswers: [
      "I mostly agree. I'd just tweak this part a little.",
      "That works for me overall. Maybe we can adjust the wording here."
    ]
  },
  {
    id: "plans-001",
    promptZh: "你想约朋友周五晚上吃饭，问他有没有空。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "随意",
    situation: "发消息约饭",
    topic: "plans",
    difficulty: "beginner",
    intent: "约饭",
    referenceAnswers: [
      "Are you free for dinner Friday night?",
      "Want to grab dinner on Friday?"
    ]
  },
  {
    id: "plans-002",
    promptZh: "朋友问几点见面，你想说七点左右都可以。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "随意",
    situation: "确认见面时间",
    topic: "plans",
    difficulty: "beginner",
    intent: "给出灵活时间",
    referenceAnswers: [
      "Around seven works for me.",
      "Anytime around seven is fine."
    ]
  },
  {
    id: "plans-003",
    promptZh: "你临时有事，想把今晚的计划改到明天。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "抱歉、商量",
    situation: "临时改约",
    topic: "plans",
    difficulty: "intermediate",
    intent: "请求改时间",
    referenceAnswers: [
      "Something came up. Could we do tomorrow instead?",
      "I'm sorry, but can we move it to tomorrow?"
    ]
  },
  {
    id: "plans-004",
    promptZh: "朋友提出一个活动，你挺感兴趣，想说听起来不错并问细节。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "感兴趣",
    situation: "朋友提议周末去一个展",
    topic: "plans",
    difficulty: "beginner",
    intent: "表达兴趣并询问细节",
    referenceAnswers: [
      "That sounds fun. What time are you thinking?",
      "I'm in. What's the plan?"
    ]
  },
  {
    id: "plans-005",
    promptZh: "你不想把行程安排得太满，想跟朋友说我们别太赶。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "放松、建议",
    situation: "制定周末安排",
    topic: "plans",
    difficulty: "intermediate",
    intent: "建议别安排太满",
    referenceAnswers: [
      "Let's not pack the day too much.",
      "Maybe we can keep it pretty relaxed."
    ]
  },
  {
    id: "plans-006",
    promptZh: "你想确认对方是否还按原计划来，因为之前没再联系。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "确认、自然",
    situation: "见面当天上午发消息",
    topic: "plans",
    difficulty: "intermediate",
    intent: "确认计划还有效",
    referenceAnswers: [
      "Are we still on for tonight?",
      "Just checking, are we still meeting later?"
    ]
  },
  {
    id: "food-001",
    promptZh: "你在咖啡店想点一杯冰拿铁，少冰。",
    speaker: "你",
    listener: "店员",
    relationship: "顾客和店员",
    mood: "礼貌、直接",
    situation: "咖啡店点单",
    topic: "food",
    difficulty: "beginner",
    intent: "点冰拿铁少冰",
    referenceAnswers: [
      "Can I get an iced latte with light ice?",
      "I'd like an iced latte, light ice, please."
    ]
  },
  {
    id: "food-002",
    promptZh: "你想问服务员这道菜会不会很辣。",
    speaker: "你",
    listener: "服务员",
    relationship: "顾客和服务员",
    mood: "礼貌",
    situation: "餐厅点菜",
    topic: "food",
    difficulty: "beginner",
    intent: "询问辣度",
    referenceAnswers: [
      "Is this dish spicy?",
      "How spicy is this one?"
    ]
  },
  {
    id: "food-003",
    promptZh: "朋友问你想吃什么，你没有特别想法，想让对方决定。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "随意",
    situation: "决定吃什么",
    topic: "food",
    difficulty: "beginner",
    intent: "表示都可以",
    referenceAnswers: [
      "I'm easy. You pick.",
      "Anything works for me."
    ]
  },
  {
    id: "food-004",
    promptZh: "你在餐厅想请服务员把剩下的打包。",
    speaker: "你",
    listener: "服务员",
    relationship: "顾客和服务员",
    mood: "礼貌",
    situation: "吃完饭还有剩菜",
    topic: "food",
    difficulty: "beginner",
    intent: "请求打包",
    referenceAnswers: [
      "Could I get a box for this?",
      "Can I have this to go?"
    ]
  },
  {
    id: "food-005",
    promptZh: "你点的菜好像上错了，想礼貌地跟服务员确认。",
    speaker: "你",
    listener: "服务员",
    relationship: "顾客和服务员",
    mood: "礼貌、确认",
    situation: "菜刚端上来",
    topic: "food",
    difficulty: "intermediate",
    intent: "确认是不是上错菜",
    referenceAnswers: [
      "Sorry, I think this might be the wrong dish.",
      "Excuse me, I ordered the chicken. Is this the right one?"
    ]
  },
  {
    id: "food-006",
    promptZh: "朋友推荐一道菜，你吃了一口觉得确实很好吃，想自然回应。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "惊喜、开心",
    situation: "餐厅吃饭",
    topic: "food",
    difficulty: "intermediate",
    intent: "回应推荐很好吃",
    referenceAnswers: [
      "Okay, you were right. This is really good.",
      "Wow, good call. This is delicious."
    ]
  },
  {
    id: "apology-001",
    promptZh: "你迟到了五分钟，见到朋友后想自然道歉。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "抱歉、轻松",
    situation: "迟到后见面",
    topic: "apology",
    difficulty: "beginner",
    intent: "为迟到道歉",
    referenceAnswers: [
      "Sorry I'm late.",
      "Sorry to keep you waiting."
    ]
  },
  {
    id: "apology-002",
    promptZh: "你不小心打断了别人讲话，想马上补一句抱歉让他继续。",
    speaker: "你",
    listener: "同事或朋友",
    relationship: "熟人",
    mood: "礼貌、快速修正",
    situation: "对话中插话",
    topic: "apology",
    difficulty: "beginner",
    intent: "为打断道歉并让对方继续",
    referenceAnswers: [
      "Sorry, go ahead.",
      "Sorry, I didn't mean to cut you off."
    ]
  },
  {
    id: "apology-003",
    promptZh: "你忘记回复朋友消息了，想诚恳但不夸张地道歉。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "抱歉、解释",
    situation: "隔了一天才回复消息",
    topic: "apology",
    difficulty: "intermediate",
    intent: "为晚回消息道歉",
    referenceAnswers: [
      "Sorry, I totally forgot to reply.",
      "Sorry for the late reply. Yesterday got away from me."
    ]
  },
  {
    id: "apology-004",
    promptZh: "你把同事发来的文件版本弄错了，想承认错误并说马上修正。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "负责、诚恳",
    situation: "工作文件出错",
    topic: "apology",
    difficulty: "intermediate",
    intent: "承认错误并表示会修正",
    referenceAnswers: [
      "Sorry, that's my mistake. I'll fix it now.",
      "You're right, I used the wrong version. I'll update it right away."
    ]
  },
  {
    id: "apology-005",
    promptZh: "你临时不能参加聚会，想跟朋友道歉并祝他们玩得开心。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "遗憾、真诚",
    situation: "聚会前取消",
    topic: "apology",
    difficulty: "intermediate",
    intent: "道歉并表达遗憾",
    referenceAnswers: [
      "I'm sorry, I can't make it tonight. Have fun though.",
      "Sorry to cancel last minute. I hope you guys have a great time."
    ]
  },
  {
    id: "apology-006",
    promptZh: "你意识到刚才语气有点冲，想主动缓和一下。",
    speaker: "你",
    listener: "朋友或同事",
    relationship: "熟人",
    mood: "反省、缓和",
    situation: "刚刚说话有点急",
    topic: "apology",
    difficulty: "advanced",
    intent: "为语气不好道歉",
    referenceAnswers: [
      "Sorry, that came out harsher than I meant.",
      "Sorry, I didn't mean to sound so sharp."
    ]
  },
  {
    id: "clarifying-001",
    promptZh: "你没明白朋友刚说的一个词，想问他是什么意思。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "好奇、自然",
    situation: "聊天时听到不懂的词",
    topic: "clarifying",
    difficulty: "beginner",
    intent: "询问意思",
    referenceAnswers: [
      "What do you mean by that?",
      "Wait, what does that mean?"
    ]
  },
  {
    id: "clarifying-002",
    promptZh: "同事给了你一个任务，你想确认截止时间是不是周三。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "确认、专业",
    situation: "分配任务后",
    topic: "clarifying",
    difficulty: "beginner",
    intent: "确认截止时间",
    referenceAnswers: [
      "Just to confirm, is this due Wednesday?",
      "So the deadline is Wednesday, right?"
    ]
  },
  {
    id: "clarifying-003",
    promptZh: "你听到对方说一个地址，但不确定门牌号，想再确认一下。",
    speaker: "你",
    listener: "对方",
    relationship: "普通熟人或工作人员",
    mood: "礼貌、确认",
    situation: "电话里确认地址",
    topic: "clarifying",
    difficulty: "intermediate",
    intent: "确认门牌号",
    referenceAnswers: [
      "Sorry, was that 15 or 50?",
      "Could you repeat the number for me?"
    ]
  },
  {
    id: "clarifying-004",
    promptZh: "朋友说“到时候再看”，你想确认他是不是还没决定。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "轻松确认",
    situation: "讨论周末安排",
    topic: "clarifying",
    difficulty: "intermediate",
    intent: "确认对方还没决定",
    referenceAnswers: [
      "So you're not sure yet?",
      "Does that mean you want to decide later?"
    ]
  },
  {
    id: "clarifying-005",
    promptZh: "会议里有人讲得有点抽象，你想请他举个具体例子。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "礼貌、求清楚",
    situation: "会议讨论",
    topic: "clarifying",
    difficulty: "intermediate",
    intent: "请求举例",
    referenceAnswers: [
      "Could you give an example?",
      "Can you make that a little more concrete?"
    ]
  },
  {
    id: "clarifying-006",
    promptZh: "对方说的方案你大概懂了，但想确认自己的理解是否正确。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "认真、确认",
    situation: "工作讨论",
    topic: "clarifying",
    difficulty: "advanced",
    intent: "复述理解并确认",
    referenceAnswers: [
      "Just so I'm clear, you're suggesting we start with the smaller group first?",
      "Let me make sure I understand. You want to test it internally before launch?"
    ]
  },
  {
    id: "reacting-001",
    promptZh: "朋友告诉你他通过了考试，你想自然地替他开心。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "开心、祝贺",
    situation: "朋友分享好消息",
    topic: "reacting",
    difficulty: "beginner",
    intent: "祝贺",
    referenceAnswers: [
      "That's awesome! Congrats!",
      "No way, that's great!"
    ]
  },
  {
    id: "reacting-002",
    promptZh: "朋友说手机又摔坏了，你想表示同情但语气随意。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "同情、随意",
    situation: "朋友吐槽坏消息",
    topic: "reacting",
    difficulty: "beginner",
    intent: "表示同情",
    referenceAnswers: [
      "Oh no, that sucks.",
      "That's so annoying."
    ]
  },
  {
    id: "reacting-003",
    promptZh: "朋友讲了一个有点离谱的故事，你想表达“真的假的”。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "惊讶、好奇",
    situation: "朋友讲经历",
    topic: "reacting",
    difficulty: "beginner",
    intent: "表达惊讶和怀疑",
    referenceAnswers: [
      "Are you serious?",
      "No way. Really?"
    ]
  },
  {
    id: "reacting-004",
    promptZh: "同事说今天要加班，你也觉得很无奈，想共情一下。",
    speaker: "你",
    listener: "同事",
    relationship: "同事",
    mood: "无奈、共情",
    situation: "下午得知要加班",
    topic: "reacting",
    difficulty: "intermediate",
    intent: "表达同感",
    referenceAnswers: [
      "Yeah, that's rough.",
      "I know, not exactly what we wanted today."
    ]
  },
  {
    id: "reacting-005",
    promptZh: "朋友给你看他新买的外套，你觉得挺适合他，想自然评价。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "真诚、轻松",
    situation: "朋友展示新衣服",
    topic: "reacting",
    difficulty: "beginner",
    intent: "称赞衣服适合对方",
    referenceAnswers: [
      "That looks really good on you.",
      "That jacket is very you."
    ]
  },
  {
    id: "reacting-006",
    promptZh: "朋友说他准备辞职，你有点惊讶但想先问他感受。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "惊讶、关心",
    situation: "朋友说出重大决定",
    topic: "reacting",
    difficulty: "advanced",
    intent: "回应重大决定并关心",
    referenceAnswers: [
      "Wow, that's a big move. How are you feeling about it?",
      "Oh wow. Are you excited, nervous, or both?"
    ]
  },
  {
    id: "emotions-001",
    promptZh: "你今天特别累，朋友问你怎么了，你想随口说累坏了。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "疲惫、随意",
    situation: "下班后聊天",
    topic: "emotions",
    difficulty: "beginner",
    intent: "表达很累",
    referenceAnswers: [
      "I'm exhausted.",
      "I'm so tired today."
    ]
  },
  {
    id: "emotions-002",
    promptZh: "你有点紧张，想告诉朋友你第一次做这个所以有点慌。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "紧张、坦白",
    situation: "第一次上台或第一次尝试新事物",
    topic: "emotions",
    difficulty: "beginner",
    intent: "表达紧张",
    referenceAnswers: [
      "I'm a little nervous. I've never done this before.",
      "I'm kind of freaking out, but I'll be okay."
    ]
  },
  {
    id: "emotions-003",
    promptZh: "朋友问你为什么今天这么开心，你想说因为事情终于搞定了。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "开心、放松",
    situation: "解决了一个拖很久的事情",
    topic: "emotions",
    difficulty: "intermediate",
    intent: "表达如释重负",
    referenceAnswers: [
      "I finally got it done, so I'm pretty relieved.",
      "That thing is finally off my plate."
    ]
  },
  {
    id: "emotions-004",
    promptZh: "你对一个决定有点后悔，想跟朋友说早知道就不那样做了。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "后悔、吐槽",
    situation: "做了一个不太好的选择后",
    topic: "emotions",
    difficulty: "intermediate",
    intent: "表达后悔",
    referenceAnswers: [
      "I kind of wish I hadn't done that.",
      "I should've thought it through a bit more."
    ]
  },
  {
    id: "emotions-005",
    promptZh: "朋友问你要不要参加活动，你其实社交电量耗尽了，想委婉拒绝。",
    speaker: "你",
    listener: "朋友",
    relationship: "朋友",
    mood: "疲惫、委婉",
    situation: "朋友临时约你出门",
    topic: "emotions",
    difficulty: "intermediate",
    intent: "表达没精力社交并拒绝",
    referenceAnswers: [
      "I think I'm going to stay in tonight. I'm pretty drained.",
      "I might pass tonight. I need some downtime."
    ]
  },
  {
    id: "emotions-006",
    promptZh: "你听到一个好消息，心里松了一口气，想自然表达“太好了，我放心了”。",
    speaker: "你",
    listener: "朋友或同事",
    relationship: "熟人",
    mood: "安心、开心",
    situation: "担心的事有了好结果",
    topic: "emotions",
    difficulty: "intermediate",
    intent: "表达放心",
    referenceAnswers: [
      "That's a relief.",
      "I'm so glad to hear that."
    ]
  }
];

export const starterScenarios: Scenario[] = rawStarterScenarios.map(
  (scenario) => ({ ...scenario, source: "starter" as const })
);
