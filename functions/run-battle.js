// Edge Function: 运行战斗模拟
// 这个函数在服务器端执行，确保战斗的公平性

module.exports = async function(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { matchId, turn, player1Id, player2Id } = await request.json();

    if (!matchId || !player1Id || !player2Id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 创建客户端访问数据库
    // createClient is injected by the worker template
    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_INTERNAL_URL') || 'http://insforge:7130',
      anonKey: Deno.env.get('ANON_KEY'),
    });

    // 获取两个玩家的棋盘状态
    const [board1Data, board2Data] = await Promise.all([
      client.database
        .from('boards')
        .select('board_state, active_synergies')
        .eq('match_id', matchId)
        .eq('player_id', player1Id)
        .single(),
      client.database
        .from('boards')
        .select('board_state, active_synergies')
        .eq('match_id', matchId)
        .eq('player_id', player2Id)
        .single(),
    ]);

    if (board1Data.error || board2Data.error) {
      return new Response(
        JSON.stringify({ error: 'Failed to load board states' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 导入战斗引擎（这里需要简化，因为Edge Function环境可能不支持复杂的导入）
    // 在实际实现中，可能需要将战斗逻辑内联或使用简化的版本

    // 简化的战斗模拟
    const player1Pieces = board1Data.data.board_state?.pieces || [];
    const player2Pieces = board2Data.data.board_state?.pieces || [];

    // 计算总攻击力
    const player1Attack = player1Pieces
      .filter(p => p.hp > 0)
      .reduce((sum, p) => sum + (p.attack[0] + p.attack[1]) / 2, 0);

    const player2Attack = player2Pieces
      .filter(p => p.hp > 0)
      .reduce((sum, p) => sum + (p.attack[0] + p.attack[1]) / 2, 0);

    // 简化的战斗结果（实际应该运行完整的回合制战斗）
    let winner = 'player1';
    let damage = Math.floor(player1Attack);

    if (player2Attack > player1Attack) {
      winner = 'player2';
      damage = Math.floor(player2Attack);
    }

    // 返回战斗结果
    return new Response(
      JSON.stringify({
        winner,
        damage,
        player1Attack: Math.floor(player1Attack),
        player2Attack: Math.floor(player2Attack),
        events: [], // 简化版本不返回详细事件
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Battle function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};
